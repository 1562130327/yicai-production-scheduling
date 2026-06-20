const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// 厚度换算规则
const THICKNESS_RULES = {
  58: 60,  // 58mm按60mm算
  54: 55,  // 54mm按55mm算
};

// 实际尺寸换算
const SIZE_RULES = {
  1: 1.05,    // 1m → 1.05m
  1.2: 1.27,  // 1.2m → 1.27m
  1.4: 1.46,  // 1.4m → 1.46m
  1.5: 1.55,  // 1.5m → 1.55m
  3: 3.07,    // 3m → 3.07m
};

// 算料计算
router.post('/calculate', async (req, res) => {
  try {
    const {
      productThickness,  // 产品厚度 (mm)
      productWidth,      // 产品宽度 (mm)
      productLength,     // 产品长度 (mm)
      productQty,        // 产品数量
      rawMaterialThickness, // 原材料厚度 (mm)
      rawMaterialWidth,     // 原材料宽度 (mm)
      rawMaterialLength     // 原材料长度 (mm)
    } = req.body;

    // 厚度换算
    let actualThickness = productThickness;
    if (THICKNESS_RULES[productThickness]) {
      actualThickness = THICKNESS_RULES[productThickness];
    }

    // 计算一床可开片数（按厚度）
    // 逻辑：原材料厚度 ÷ 客户需要的厚度 = 可以开多少张片材
    // 例如：原材料60mm ÷ 客户需要28mm = 2张
    const sheetsPerBed = Math.floor(rawMaterialThickness / actualThickness);

    // 计算一张原材料能切多少片（按长宽）
    const actualRawWidth = SIZE_RULES[rawMaterialWidth] || rawMaterialWidth;
    const actualRawLength = SIZE_RULES[rawMaterialLength] || rawMaterialLength;

    const piecesPerSheetByWidth = Math.floor(actualRawWidth * 1000 / productWidth);
    const piecesPerSheetByLength = Math.floor(actualRawLength * 1000 / productLength);
    const piecesPerSheet = piecesPerSheetByWidth * piecesPerSheetByLength;

    // 计算需要多少张原材料
    const totalPiecesNeeded = Math.ceil(productQty / sheetsPerBed);
    const sheetsNeeded = Math.ceil(totalPiecesNeeded / piecesPerSheet);

    // 计算需要多少床
    const bedsNeeded = Math.ceil(productQty / (sheetsPerBed * piecesPerSheet));

    res.json({
      // 输入参数
      input: {
        productThickness,
        productWidth,
        productLength,
        productQty,
        rawMaterialThickness,
        rawMaterialWidth,
        rawMaterialLength
      },
      // 计算结果
      result: {
        actualThickness,  // 换算后的厚度
        sheetsPerBed,     // 一床可开片数
        piecesPerSheet,   // 一张可切片数
        piecesPerSheetByWidth,  // 宽度方向可切数
        piecesPerSheetByLength, // 长度方向可切数
        sheetsNeeded,     // 需要原材料张数
        bedsNeeded,       // 需要床数
        totalPieces,      // 总可产出片数
        waste: (sheetsNeeded * piecesPerSheet * sheetsPerBed) - productQty // 废料数
      },
      // 换算说明
      notes: {
        thicknessRule: THICKNESS_RULES[productThickness] ? `${productThickness}mm → ${actualThickness}mm` : '无需换算',
        sizeRule: `${rawMaterialWidth}m → ${actualRawWidth}m, ${rawMaterialLength}m → ${actualRawLength}m`
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 获取算料规则
router.get('/rules', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM calculation_rules ORDER BY rule_type, from_value');
    res.json({
      thicknessRules: THICKNESS_RULES,
      sizeRules: SIZE_RULES,
      dbRules: rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

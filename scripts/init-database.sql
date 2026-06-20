CREATE DATABASE IF NOT EXISTS production_scheduling;
USE production_scheduling;

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(50) COMMENT '订单编号',
  style_no VARCHAR(50) COMMENT '款号',
  customer VARCHAR(100) NOT NULL COMMENT '客户名称',
  process_type VARCHAR(50) NOT NULL COMMENT '加工工艺',
  category VARCHAR(50) COMMENT '类别',
  priority VARCHAR(20) DEFAULT '普通' COMMENT '优先级',
  remark TEXT COMMENT '备注',
  material VARCHAR(200) COMMENT '用料',
  sheet_size VARCHAR(100) COMMENT '片材尺寸',
  sheet_qty VARCHAR(50) COMMENT '片材数量',
  slice_size VARCHAR(100) COMMENT '切片尺寸',
  slice_qty VARCHAR(50) COMMENT '切片数量',
  punch_size VARCHAR(100) COMMENT '冲型尺寸',
  punch_qty VARCHAR(50) COMMENT '冲型数量',
  punch_process VARCHAR(100) COMMENT '冲型工艺',
  status VARCHAR(20) DEFAULT '待开始' COMMENT '状态',
  order_date DATE COMMENT '下单日期',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='生产订单表';

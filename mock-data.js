const mockOrders = [
  // 片材类
  { id: 1, customer: "兴达", process_type: "片材", category: "片材类", material: "白色38°B料EVA（岳东）", sheet_size: "1.44m*3.06m*25mm", sheet_qty: "60张", priority: "普通", status: "进行中", order_date: "2026-06-15" },
  { id: 2, customer: "兴达", process_type: "片材", category: "片材类", material: "白色38°B料EVA（岳东）", sheet_size: "1.44m*3.06m*7mm", sheet_qty: "100张", priority: "普通", status: "待开始", order_date: "2026-06-15" },
  { id: 3, customer: "立优", process_type: "片材", category: "片材类", material: "黑色高发泡1800（易升）", sheet_size: "1.5m*2.4m*10mm", sheet_qty: "2张", priority: "低", status: "已完成", order_date: "2026-06-15" },
  { id: 4, customer: "立优", process_type: "片材", category: "片材类", material: "黑色高发泡1800（易升）", sheet_size: "1.5m*2.4m*14mm", sheet_qty: "5张", priority: "低", status: "进行中", order_date: "2026-06-09" },
  { id: 5, customer: "雨田", process_type: "片材", category: "片材类", material: "黑色38°B料EvA（福能）", sheet_size: "1.07m*3.08m*2mm", sheet_qty: "40张", priority: "普通", status: "待开始", order_date: "2026-06-15" },
  { id: 6, customer: "雨田", process_type: "片材", category: "片材类", material: "黑色38°B料EvA（福能）", sheet_size: "1.07m*3.08m*3.5mm", sheet_qty: "40张", priority: "低", status: "待开始", order_date: "2026-06-15" },
  // 片材切片类
  { id: 7, customer: "得景", process_type: "片材切片", category: "切片类", material: "黑色38°B料EvA（福能）", sheet_size: "1.55m*3.05m*6mm", sheet_qty: "250张", slice_size: "250*250*6mm", slice_qty: "17900片", priority: "普通", status: "进行中", order_date: "2026-05-28" },
  { id: 8, customer: "得景", process_type: "片材切片", category: "切片类", material: "黑色38°B料EvA（福能）", sheet_size: "1.46m*3.05m*6mm", sheet_qty: "22.8张", slice_size: "280*140*6mm", slice_qty: "2400片", priority: "普通", status: "待开始", order_date: "2026-05-28" },
  { id: 9, customer: "德坤", process_type: "片材切片", category: "切片类", material: "白色38°B料EVA（岳东）", sheet_size: "1.25m*3.04m*9mm", sheet_qty: "25张", slice_size: "550*295*9mm", slice_qty: "500片", priority: "注意", status: "待开始", order_date: "2026-06-12" },
  { id: 10, customer: "德坤", process_type: "片材切片", category: "切片类", material: "黑色38°B料EvA（福能）", sheet_size: "1.55m*3.05m*9mm", sheet_qty: "119.1张", slice_size: "505*430*9mm", slice_qty: "2500片", priority: "注意", status: "进行中", order_date: "2026-06-12" },
  { id: 11, customer: "正欲", process_type: "片材切片", category: "切片类", material: "白色38°B料EVA（岳东）", sheet_size: "1.5m*3m*3mm", sheet_qty: "34张", slice_size: "1m*1.5m*3mm", slice_qty: "102片", priority: "注意", status: "待开始", order_date: "2026-06-18" },
  { id: 12, customer: "正欲", process_type: "片材切片", category: "切片类", material: "白色38°B料EVA（岳东）", sheet_size: "1.5m*3m*12mm", sheet_qty: "34张", slice_size: "1m*1.5m*12mm", slice_qty: "102片", priority: "注意", status: "待开始", order_date: "2026-06-18" },
  { id: 13, customer: "盛琪", process_type: "片材切片", category: "切片类", material: "白色38°B料EVA（岳东）", sheet_size: "1.25m*3.04m*20mm", sheet_qty: "16张", slice_size: "240*230*20mm", slice_qty: "1040片", priority: "普通", status: "进行中", order_date: "2026-06-15" },
  { id: 14, customer: "鑫泽", process_type: "片材切片", category: "切片类", material: "白色45°B料（辉煌）", sheet_size: "1m*2.8m*20mm", sheet_qty: "60张", slice_size: "1m*(2.1m+0.74m)", slice_qty: "60片", priority: "普通", status: "待开始", order_date: "2026-06-15" },
  { id: 15, customer: "雅轩", process_type: "片材切片", category: "切片类", material: "白色38°B料EVA（岳东）", sheet_size: "1.47m*2.94m*2.5mm", sheet_qty: "4.8张", slice_size: "178*263*2.5mm", slice_qty: "418片", priority: "注意", status: "待开始", order_date: "2026-06-10" },
  { id: 16, customer: "雅轩", process_type: "片材切片", category: "切片类", material: "白色38°B料EVA（岳东）", sheet_size: "1.07m*3.08m*17mm", sheet_qty: "5.7张", slice_size: "170*253*17mm", slice_qty: "410片", priority: "注意", status: "待开始", order_date: "2026-06-10" },
  { id: 17, customer: "宇坤", process_type: "片材切片", category: "切片类", material: "黑色38°B料EVA（福能）", sheet_size: "1.2m*2m*8mm", sheet_qty: "60张", slice_size: "400*314*8mm", slice_qty: "1620片", priority: "普通", status: "进行中", order_date: "2026-06-16" },
  // 片材冲型类
  { id: 18, customer: "六点半", process_type: "片材冲型", category: "冲型类", material: "黑色38°B料EvA（福能）", sheet_size: "1.44m*3.1m*10mm", sheet_qty: "24.1张", punch_size: "230*210*10mm", punch_qty: "2020个", priority: "注意", status: "进行中", order_date: "2026-06-15" },
  { id: 19, customer: "六点半", process_type: "片材冲型", category: "冲型类", material: "黑色38°B料EvA（福能）", sheet_size: "1.44m*3.1m*26mm", sheet_qty: "24.1张", punch_size: "230*210*26mm", punch_qty: "2020个", priority: "注意", status: "待开始", order_date: "2026-06-15" },
  { id: 20, customer: "六点半", process_type: "片材冲型", category: "冲型类", material: "黑色38°B料EvA（福能）", sheet_size: "1.44m*3.1m*5mm", sheet_qty: "24.1张", punch_size: "230*210*5mm", punch_qty: "2020个", priority: "注意", status: "待开始", order_date: "2026-06-15" },
  { id: 21, customer: "安源", process_type: "片材冲型", category: "冲型类", material: "白色38°B料EVA（岳东）", sheet_size: "1.46m*3.1m*25mm", sheet_qty: "76张", punch_size: "116*131*25mm", punch_qty: "18215个", priority: "注意", status: "进行中", order_date: "2026-06-15" },
  { id: 22, customer: "安源", process_type: "片材冲型", category: "冲型类", material: "白色38°B料EVA（岳东）", sheet_size: "1.46m*3.07m*5mm", sheet_qty: "138张", punch_size: "115*130*5mm", punch_qty: "18215个", priority: "注意", status: "待开始", order_date: "2026-06-15" },
  { id: 23, customer: "安源", process_type: "片材冲型", category: "冲型类", material: "白色38°B料EVA（岳东）", sheet_size: "1.46m*2.96m*20mm", sheet_qty: "55.1张", punch_size: "86*116*20mm", punch_qty: "18179个", priority: "注意", status: "进行中", order_date: "2026-06-15" },
  { id: 24, customer: "瑞泰", process_type: "片材冲型", category: "冲型类", material: "白色38°BC料（宏泰）", sheet_size: "1.44m*3.05m*10mm", sheet_qty: "2.8张", punch_size: "74*100*10mm", punch_qty: "1300个", priority: "普通", status: "待开始", order_date: "2026-06-12" },
  { id: 25, customer: "睿泰", process_type: "片材冲型", category: "冲型类", material: "黑色38°BC料（宏泰）", sheet_size: "1.44m*2.97m*4mm", sheet_qty: "15.5张", punch_size: "190*282*4mm", punch_qty: "1085个", priority: "注意", status: "待开始", order_date: "2026-06-16" },
  { id: 26, customer: "伊斯通", process_type: "片材冲型", category: "冲型类", material: "黑色38°B料EVA（福能）", sheet_size: "1.45m*2.86m*2mm", sheet_qty: "10.7张", punch_size: "464.5*59.5*2mm", punch_qty: "1400个", priority: "普通", status: "待开始", order_date: "2026-06-16" },
  { id: 27, customer: "伊斯通", process_type: "片材冲型", category: "冲型类", material: "黑色38°B料EVA（福能）", sheet_size: "1.53m*2.95m*2mm", sheet_qty: "7.7张", punch_size: "355*60*2mm", punch_qty: "1400个", priority: "普通", status: "待开始", order_date: "2026-06-16" },
  { id: 28, customer: "枫华", process_type: "片材冲型", category: "冲型类", material: "黑色38°B料EVA（福能）", sheet_size: "204*125*10mm", sheet_qty: "100片", punch_qty: "100个", priority: "普通", status: "待开始", order_date: "2026-06-17" },
  { id: 29, customer: "枫华", process_type: "片材冲型", category: "冲型类", material: "白色38°B料EVA（岳东）", sheet_size: "204*125*10mm", sheet_qty: "100片", priority: "普通", status: "待开始", order_date: "2026-06-17" },
  { id: 30, customer: "杰斯丽", process_type: "片材冲型", category: "冲型类", material: "黑色38°B料EVA（福能）", punch_size: "124.5*82.5*13mm", punch_qty: "3520个", priority: "普通", status: "待开始", order_date: "2026-06-17" },
  { id: 31, customer: "三匠", process_type: "片材冲型", category: "冲型类", material: "黑色38°B料EVA（福能）", sheet_size: "1.5m*2.5m*40mm", sheet_qty: "22.1张", slice_size: "250*307mm", slice_qty: "1060片", punch_size: "237*147mm", punch_qty: "2120个", priority: "普通", status: "待开始", order_date: "2026-06-17" },
  // 片材背胶切片冲型
  { id: 32, customer: "客户A", process_type: "片材背胶切片冲型", category: "复合类", material: "白色38°B料EVA（岳东）", sheet_size: "1.5m*3m*5mm", sheet_qty: "50张", slice_size: "200*200*5mm", slice_qty: "5000片", punch_size: "180*180*5mm", punch_qty: "5000个", priority: "普通", status: "进行中", order_date: "2026-06-18" },
  { id: 33, customer: "客户B", process_type: "片材背胶切片冲型", category: "复合类", material: "黑色38°B料EVA（福能）", sheet_size: "1.4m*2.8m*8mm", sheet_qty: "30张", slice_size: "150*150*8mm", slice_qty: "3000片", punch_size: "130*130*8mm", punch_qty: "3000个", priority: "注意", status: "待开始", order_date: "2026-06-19" },
  { id: 34, customer: "客户C", process_type: "片材背胶切片冲型", category: "复合类", material: "白色38°B料EVA（岳东）", sheet_size: "1.2m*2.5m*6mm", sheet_qty: "40张", slice_size: "180*180*6mm", slice_qty: "4000片", punch_size: "160*160*6mm", punch_qty: "4000个", priority: "普通", status: "进行中", order_date: "2026-06-18" },
  { id: 35, customer: "客户D", process_type: "片材背胶切片冲型", category: "复合类", material: "黑色38°B料EVA（福能）", sheet_size: "1.6m*3.2m*4mm", sheet_qty: "25张", slice_size: "220*220*4mm", slice_qty: "2500片", punch_size: "200*200*4mm", punch_qty: "2500个", priority: "普通", status: "待开始", order_date: "2026-06-20" },
  { id: 36, customer: "客户E", process_type: "片材背胶切片冲型", category: "复合类", material: "白色38°B料EVA（岳东）", sheet_size: "1.3m*2.6m*7mm", sheet_qty: "35张", slice_size: "190*190*7mm", slice_qty: "3500片", punch_size: "170*170*7mm", punch_qty: "3500个", priority: "注意", status: "进行中", order_date: "2026-06-19" },
  { id: 37, customer: "客户F", process_type: "片材背胶切片冲型", category: "复合类", material: "黑色38°B料EVA（福能）", sheet_size: "1.4m*2.8m*3mm", sheet_qty: "60张", slice_size: "160*160*3mm", slice_qty: "6000片", punch_size: "140*140*3mm", punch_qty: "6000个", priority: "普通", status: "待开始", order_date: "2026-06-20" },
  // 库存冲型
  { id: 38, customer: "客户G", process_type: "库存冲型", category: "冲型类", material: "库存材料A", punch_size: "100*100*10mm", punch_qty: "5000个", priority: "普通", status: "进行中", order_date: "2026-06-17" },
  { id: 39, customer: "客户H", process_type: "库存冲型", category: "冲型类", material: "库存材料B", punch_size: "120*80*8mm", punch_qty: "3000个", priority: "注意", status: "待开始", order_date: "2026-06-18" },
  { id: 40, customer: "客户I", process_type: "库存冲型", category: "冲型类", material: "库存材料C", punch_size: "150*150*6mm", punch_qty: "4000个", priority: "普通", status: "进行中", order_date: "2026-06-17" },
  { id: 41, customer: "客户J", process_type: "库存冲型", category: "冲型类", material: "库存材料D", punch_size: "80*60*12mm", punch_qty: "2000个", priority: "低", status: "待开始", order_date: "2026-06-19" },
  // 切片冲型
  { id: 42, customer: "客户K", process_type: "切片冲型", category: "冲型类", material: "白色38°B料EVA（岳东）", slice_size: "200*200*5mm", slice_qty: "2000片", punch_size: "180*180*5mm", punch_qty: "2000个", priority: "普通", status: "进行中", order_date: "2026-06-18" },
  // 片材贴布切片冲型
  { id: 43, customer: "客户L", process_type: "片材贴布切片冲型", category: "复合类", material: "黑色38°B料EVA（福能）", sheet_size: "1.5m*3m*4mm", sheet_qty: "20张", slice_size: "180*180*4mm", slice_qty: "2000片", punch_size: "160*160*4mm", punch_qty: "2000个", priority: "注意", status: "待开始", order_date: "2026-06-19" },
  // 片材切片冲型
  { id: 44, customer: "客户M", process_type: "片材切片冲型", category: "冲型类", material: "白色38°B料EVA（岳东）", sheet_size: "1.4m*2.8m*6mm", sheet_qty: "45张", slice_size: "200*150*6mm", slice_qty: "4000片", punch_size: "180*130*6mm", punch_qty: "4000个", priority: "普通", status: "进行中", order_date: "2026-06-18" },
  { id: 45, customer: "客户N", process_type: "片材切片冲型", category: "冲型类", material: "黑色38°B料EVA（福能）", sheet_size: "1.3m*2.6m*8mm", sheet_qty: "35张", slice_size: "170*170*8mm", slice_qty: "3500片", punch_size: "150*150*8mm", punch_qty: "3500个", priority: "注意", status: "待开始", order_date: "2026-06-20" },
  // 库存切片冲型
  { id: 46, customer: "客户O", process_type: "库存切片冲型", category: "冲型类", material: "库存切片A", slice_size: "150*150*5mm", slice_qty: "3000片", punch_size: "130*130*5mm", punch_qty: "3000个", priority: "普通", status: "进行中", order_date: "2026-06-18" },
  // 片材背胶冲型
  { id: 47, customer: "客户P", process_type: "片材背胶冲型", category: "冲型类", material: "白色38°B料EVA（岳东）", sheet_size: "1.5m*3m*5mm", sheet_qty: "40张", punch_size: "180*180*5mm", punch_qty: "4000个", priority: "普通", status: "进行中", order_date: "2026-06-18" },
  { id: 48, customer: "客户Q", process_type: "片材背胶冲型", category: "冲型类", material: "黑色38°B料EVA（福能）", sheet_size: "1.4m*2.8m*7mm", sheet_qty: "30张", punch_size: "160*160*7mm", punch_qty: "3000个", priority: "注意", status: "待开始", order_date: "2026-06-19" },
  { id: 49, customer: "客户R", process_type: "片材背胶冲型", category: "冲型类", material: "白色38°B料EVA（岳东）", sheet_size: "1.6m*3.2m*4mm", sheet_qty: "50张", punch_size: "200*200*4mm", punch_qty: "5000个", priority: "普通", status: "进行中", order_date: "2026-06-18" },
  { id: 50, customer: "客户S", process_type: "片材背胶冲型", category: "冲型类", material: "黑色38°B料EVA（福能）", sheet_size: "1.3m*2.6m*6mm", sheet_qty: "35张", punch_size: "140*140*6mm", punch_qty: "3500个", priority: "低", status: "待开始", order_date: "2026-06-20" },
  { id: 51, customer: "客户T", process_type: "片材背胶冲型", category: "冲型类", material: "白色38°B料EVA（岳东）", sheet_size: "1.2m*2.4m*8mm", sheet_qty: "25张", punch_size: "120*120*8mm", punch_qty: "2500个", priority: "普通", status: "进行中", order_date: "2026-06-19" },
];

module.exports = mockOrders;

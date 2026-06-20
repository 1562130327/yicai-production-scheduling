const workers = [
  { id: 1, name: "张师傅", skill: "冲型", phone: "13800001111" },
  { id: 2, name: "李师傅", skill: "切片", phone: "13800002222" },
  { id: 3, name: "王师傅", skill: "片材", phone: "13800003333" },
  { id: 4, name: "赵师傅", skill: "分切", phone: "13800004444" },
  { id: 5, name: "刘师傅", skill: "冲床", phone: "13800005555" },
  { id: 6, name: "陈师傅", skill: "热熔", phone: "13800006666" },
  { id: 7, name: "杨师傅", skill: "点胶", phone: "13800007777" },
  { id: 8, name: "黄师傅", skill: "排废", phone: "13800008888" }
];

const machines = [
  { id: 1, name: "横竖分切机", type: "分切", status: "运行中" },
  { id: 2, name: "破片机", type: "切片", status: "运行中" },
  { id: 3, name: "直切机", type: "切片", status: "空闲" },
  { id: 4, name: "100T冲床A面", type: "冲床", status: "运行中" },
  { id: 5, name: "100T冲床B面", type: "冲床", status: "空闲" },
  { id: 6, name: "新自动冲床", type: "冲床", status: "运行中" },
  { id: 7, name: "旧自动冲床", type: "冲床", status: "维护中" },
  { id: 8, name: "热熔胶机", type: "热熔", status: "运行中" },
  { id: 9, name: "点胶机1", type: "点胶", status: "运行中" },
  { id: 10, name: "点胶机2", type: "点胶", status: "空闲" },
  { id: 11, name: "排废机1", type: "排废", status: "运行中" },
  { id: 12, name: "排废机2", type: "排废", status: "运行中" },
  { id: 13, name: "改回填机", type: "回填", status: "空闲" },
  { id: 14, name: "排废改回填机", type: "回填", status: "运行中" }
];

const casualWorkers = [
  { id: 1, name: "小张", type: "打杂", assignedTo: "杂活" },
  { id: 2, name: "小李", type: "打杂", assignedTo: "杂活" },
  { id: 3, name: "小王", type: "配合", assignedTo: "100T冲床A面" },
  { id: 4, name: "小赵", type: "配合", assignedTo: "新自动冲床" },
  { id: 5, name: "小刘", type: "配合", assignedTo: "热熔胶机" },
  { id: 6, name: "小陈", type: "打杂", assignedTo: "杂活" },
  { id: 7, name: "小杨", type: "配合", assignedTo: "点胶机1" },
  { id: 8, name: "小黄", type: "配合", assignedTo: "排废机1" }
];

const assignments = [
  { machineId: 1, workerId: 4 },
  { machineId: 2, workerId: 2 },
  { machineId: 4, workerId: 5 },
  { machineId: 6, workerId: 5 },
  { machineId: 8, workerId: 6 },
  { machineId: 9, workerId: 7 },
  { machineId: 11, workerId: 8 },
  { machineId: 12, workerId: 8 },
  { machineId: 14, workerId: 8 }
];

module.exports = { workers, machines, casualWorkers, assignments };

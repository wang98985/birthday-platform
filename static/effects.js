/* 特效库清单（来自 https://github.com/rover95/effect）
 * 供首页特效库区块 / 添加模板弹窗使用。
 */
(function (g) {
  "use strict";
  var list = [
    { id: "starfield", name: "星空", desc: "深空星海缓缓流动，安静又浪漫", accent: "#8fb8ff" },
    { id: "swirl", name: "旋涡", desc: "彩色粒子旋涡，视觉冲击力强", accent: "#b78cff" },
    { id: "fireworks", name: "烟花", desc: "点击放烟花，夜空绽放", accent: "#ffb36b" },
    { id: "fireworkshooter", name: "烟花射击", desc: "自动升空连放，烟花秀不停", accent: "#ff8f7a" },
    { id: "smoke", name: "烟雾", desc: "体积烟雾与光字，神秘高级", accent: "#5ad2d2" },
    { id: "fireball", name: "火球射击", desc: "火球射出爆炸，力量感十足", accent: "#ff7a45" },
    { id: "oillight", name: "炫彩油光", desc: "油膜虹彩流动，高级质感", accent: "#7fe3c0" },
    { id: "gradientwave", name: "渐变波浪", desc: "渐变波浪起伏，柔和呼吸感", accent: "#6ec6ff" },
    { id: "swim", name: "游动", desc: "流体般游动的彩色轨迹", accent: "#7be0a8" },
    { id: "colortext", name: "彩色文字", desc: "彩色粒子描出流动字形", accent: "#ff8fd0" },
    { id: "glitchword", name: "故障词", desc: "故障艺术文字抖动闪烁", accent: "#ff5d7a" },
    { id: "charmatrix", name: "字符矩阵", desc: "字符流涌动，赛博代码感", accent: "#7dff9e" },
    { id: "particles", name: "粒子", desc: "轻盈粒子漂浮聚散", accent: "#a9c8ff" },
    { id: "particlematrix", name: "粒子矩阵", desc: "粒子矩阵排列与重组", accent: "#8ff0ff" },
    { id: "particlemotion", name: "粒子运动", desc: "粒子轨迹运动，动感流畅", accent: "#9fb6ff" },
    { id: "randomparticles", name: "随机粒子", desc: "随机粒子碰撞与连接", accent: "#c3a6ff" },
    { id: "monochrome", name: "黑白旋转", desc: "黑白几何旋转，极简艺术", accent: "#d6d2c8" },
    { id: "mazering", name: "迷宫环绕", desc: "线条迷宫环绕旋转", accent: "#c9b98f" },
    { id: "crtscreen", name: "复古屏幕", desc: "CRT 扫描线与色差，复古电视质感", accent: "#ff9ec4" },
    { id: "loader", name: "加载圈", desc: "极简旋转加载动画，利落干净", accent: "#b8b2a4" },
    { id: "fallingtime", name: "下落时间", desc: "数字与光点下坠，时间流逝感", accent: "#cfc6ae" },
    { id: "effectbtn", name: "特效按钮", desc: "光效按钮，互动感强", accent: "#a78bfa" },
    { id: "game2048", name: "3D 版 2048", desc: "Three.js 立体 2048，方向键可玩", accent: "#8fa6ff" },
    // 星河蛋糕模板内置特效（复用 3D 蛋糕场景）
    { id: "cake-galaxy", name: "星河漫游", desc: "3D 蛋糕 + 环绕星河，可拖拽旋转", accent: "#ffd27a" },
    { id: "cake-snow", name: "落雪蛋糕", desc: "3D 蛋糕 + 细雪飘落", accent: "#bfe4ff" },
    { id: "cake-meteor", name: "流星许愿", desc: "3D 蛋糕 + 流星雨划过", accent: "#ffe9a8" },
    { id: "cake-halo", name: "奇幻光环", desc: "3D 蛋糕 + 光环旋绕", accent: "#c9a6ff" }
  ];
  g.BirthdayEffects = list;
})(window);

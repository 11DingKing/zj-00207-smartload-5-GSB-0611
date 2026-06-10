const http = require("http");

const testAPI = (path, description) => {
  return new Promise((resolve) => {
    const options = {
      hostname: "localhost",
      port: 3000,
      path: path,
      method: "GET",
    };

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          console.log(`✅ ${description}`);
          console.log(`   状态: ${res.statusCode}`);
          resolve(result);
        } catch (e) {
          console.log(`❌ ${description}`);
          console.log(`   解析失败: ${e.message}`);
          resolve(null);
        }
      });
    });

    req.on("error", (e) => {
      console.log(`❌ ${description}`);
      console.log(`   错误: ${e.message}`);
      resolve(null);
    });

    req.setTimeout(10000, () => {
      console.log(`⏱️  ${description} - 超时`);
      req.destroy();
      resolve(null);
    });

    req.end();
  });
};

const runTests = async () => {
  console.log("\n" + "=".repeat(60));
  console.log("🚗 SmartLoad API 测试");
  console.log("=".repeat(60) + "\n");

  await testAPI("/api/health", "健康检查");
  await testAPI("/api/summary", "数据汇总");
  await testAPI("/api/constants", "常量定义");
  await testAPI("/api/config-items/stats", "配置项统计");
  await testAPI("/api/config-items?status=NEW", "新增配置项列表");
  await testAPI("/api/analytics/grade-analysis", "档次分析");
  await testAPI("/api/analytics/high-adoption", "高普及率配置");
  await testAPI(
    "/api/analytics/optimization-suggestions?weightThreshold=3&usageThreshold=true",
    "减重建议（只看不常用的）"
  );
  await testAPI("/api/analytics/category-analysis", "类别重量分析");

  const vehicle1 = await testAPI("/api/vehicles/37", "仰望U8 豪华版详情");
  if (vehicle1 && vehicle1.data) {
    const v = vehicle1.data;
    console.log(`\n📊 仰望U8 重量分析:`);
    console.log(`   基础重量: ${v.baseWeight} kg`);
    console.log(`   智能增重: ${v.smartWeight.toFixed(1)} kg`);
    console.log(`   总重量: ${v.totalWeight.toFixed(1)} kg`);
    console.log(`   配置数量: ${v.totalConfigs} 项`);
    console.log(`   类别占比:`);
    v.categoryBreakdown.forEach((c) => {
      console.log(`     ${c.categoryLabel}: ${c.weight.toFixed(1)} kg (${c.percentage}%)`);
    });
  }

  const vehicle2 = await testAPI("/api/vehicles/56", "比亚迪汉EV 中配详情");
  if (vehicle2 && vehicle2.data) {
    const v = vehicle2.data;
    console.log(`\n📊 比亚迪汉EV 中配 重量分析:`);
    console.log(`   基础重量: ${v.baseWeight} kg`);
    console.log(`   智能增重: ${v.smartWeight.toFixed(1)} kg`);
    console.log(`   总重量: ${v.totalWeight.toFixed(1)} kg`);
    console.log(`   配置数量: ${v.totalConfigs} 项`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ 测试完成");
  console.log("=".repeat(60) + "\n");
};

runTests();

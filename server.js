const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { exec } = require("child_process");
const fs = require("fs").promises;
const path = require("path");
const util = require("util");
const execPromise = util.promisify(exec);
const os = require("os");
const { spawn } = require("child_process");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
require("dotenv").config(); // 添加这行来加载 .env 文件
const fetch = require("node-fetch");
const WebSocket = require("ws");

const app = express();
const port = 3001;

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
app.use(bodyParser.json());

let minecraftServerPath = "";

// 查找Minecraft服务器文件夹
const findMinecraftServerFolder = async () => {
  const possibleRootDirs =
    os.platform() === "darwin" ? ["/Users/tovkaic/Desktop"] : ["/home"];

  const searchDirectory = async (dir, depth = 0) => {
    if (depth > 5) return; // 限制搜索深度，防止无限递归

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const fullPath = path.join(dir, entry.name);
          const hasRequiredFiles = await checkRequiredFiles(fullPath);
          if (hasRequiredFiles) {
            minecraftServerPath = fullPath;
            console.log(`找到Minecraft服务器文件夹: ${minecraftServerPath}`);
            return true;
          }
          // 递归搜索子目录
          const found = await searchDirectory(fullPath, depth + 1);
          if (found) return true;
        }
      }
    } catch (error) {
      console.error(`搜索 ${dir} 时出错: ${error}`);
    }
    return false;
  };

  for (const rootDir of possibleRootDirs) {
    const found = await searchDirectory(rootDir);
    if (found) return;
  }

  throw new Error("无法找到有效的Minecraft服务器文件夹");
};

// 检查文件夹是否包含所需的文件和目录
const checkRequiredFiles = async (folderPath) => {
  try {
    const stats = await Promise.all([
      fs.stat(path.join(folderPath, "backups")),
      fs.stat(path.join(folderPath, "eula.txt")),
      fs.stat(path.join(folderPath, "world")),
      fs.stat(path.join(folderPath, "server.properties")),
    ]);

    return (
      stats[0].isDirectory() && // backups 是目��
      stats[1].isFile() && // eula.txt 是文件
      stats[2].isDirectory() && // world 是目录
      stats[3].isFile() // server.properties 是文件
    );
  } catch (error) {
    return false;
  }
};

// 使用环境变量中的 JWT_SECRET
const JWT_SECRET = process.env.JWT_SECRET;

// 在服务器启动时生成密码哈希
let HASHED_PASSWORD;
bcrypt.hash(process.env.LOGIN_PASSWORD, 10).then((hash) => {
  HASHED_PASSWORD = hash;
});

// 验证 JWT token 的中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// 登录路由
app.post("/api/login", async (req, res) => {
  const { password } = req.body;

  try {
    if (await bcrypt.compare(password, HASHED_PASSWORD)) {
      const token = jwt.sign({ username: "admin" }, JWT_SECRET, {
        expiresIn: "30m",
      });
      res.json({ success: true, token });
    } else {
      res.status(401).json({ success: false, message: "密码错误" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "服务器错误" });
  }
});

// 获取备份列表
app.get("/api/backups", authenticateToken, async (req, res) => {
  try {
    if (!minecraftServerPath) {
      await findMinecraftServerFolder();
    }

    const backupPath = path.join(minecraftServerPath, "backups/world");
    const backups = {
      path: backupPath,
      differential: [],
      incremental: [],
      snapshots: [],
      zips: [],
    };

    // 检查并获取各类型备份
    for (const type of ["differential", "incremental", "snapshots"]) {
      try {
        backups[type] = await getZipFiles(path.join(backupPath, type));
      } catch (error) {
        console.log(`No ${type} backups found in ${backupPath}`);
      }
    }

    // 检查并获取根目录下的 zip 文件
    try {
      backups.zips = await getZipFiles(backupPath);
    } catch (error) {
      console.log(`No zip files found in root backup directory ${backupPath}`);
    }

    res.json([backups]);
  } catch (err) {
    console.error(`读取备份目录错误: ${err}`);
    return res.status(500).json({ error: "无法读取备份列表" });
  }
});

// 获取指定目录下的zip文件，并按名称排序
const getZipFiles = async (dir) => {
  const files = await fs.readdir(dir);
  return files
    .filter((file) => file.endsWith(".zip"))
    .sort((a, b) => {
      // 假设文件名格式为 "YYYY-MM-DD_HH-mm-ss.zip"
      return a.localeCompare(b);
    });
};

// 关闭Minecraft服器
app.post("/api/stop-minecraft", authenticateToken, async (req, res) => {
  try {
    if (!minecraftServerPath) {
      await findMinecraftServerFolder();
    }
    await execPromise(
      `cd ${minecraftServerPath} && screen -S mc -X stuff '/stop\n'`
    );
    res.json({ message: "已发送停止命令到Minecraft服务器" });
  } catch (error) {
    console.error(`执行错误: ${error}`);
    return res.status(500).json({ error: "无法停止Minecraft服务器" });
  }
});

// 检查Minecraft服务器是否正在运行
const isMinecraftRunning = async () => {
  try {
    let command;
    if (os.platform() === "darwin") {
      // macOS
      command =
        "pgrep -f '/opt/homebrew/Cellar/openjdk@21/21.0.4/bin/java.*fabric.jar'";
    } else {
      // Ubuntu 或其他 Linux 系统
      command = "pgrep -f 'java.*fabric.jar'";
    }
    const { stdout } = await execPromise(command);
    return stdout.trim() !== "";
  } catch (error) {
    return false;
  }
};

// 关闭Minecraft服务器
const stopMinecraftServer = async () => {
  if (!minecraftServerPath) {
    await findMinecraftServerFolder();
  }
  await execPromise(
    `cd ${minecraftServerPath} && screen -S mc -X stuff '/stop\n'`
  );

  // 等待服务器完全关闭
  while (await isMinecraftRunning()) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
};

// 创建 WebSocket 服务器
const wss = new WebSocket.Server({ noServer: true });

// 修改恢复备份的路由
app.post("/api/restore-backup", authenticateToken, async (req, res) => {
  try {
    const { backupName, backupType } = req.body;

    if (!minecraftServerPath) {
      await findMinecraftServerFolder();
    }

    // 检查服务器是否正在运行
    const serverRunning = await isMinecraftRunning();
    if (serverRunning) {
      // 如果服务器正在运行，则停止它
      await stopMinecraftServer();
      console.log("Minecraft服务器已停止");
    } else {
      console.log("Minecraft服务器已经处于停止状态");
    }

    // 设置脚本权限
    const scriptPath = path.join(
      minecraftServerPath,
      "backups",
      "restore-script.sh"
    );
    await execPromise(`chmod +x ${scriptPath}`);

    // 获取备份列表并找到指定备份的索引
    const backupPath = path.join(minecraftServerPath, "backups/world");
    let backups;
    if (backupType === "zips") {
      backups = await getZipFiles(backupPath);
    } else {
      backups = await getZipFiles(path.join(backupPath, backupType));
    }
    const backupIndex =
      backups.findIndex((backup) => backup === backupName) + 1; // 加1是因为脚本中的索引从1开始

    if (backupIndex === 0) {
      throw new Error(`找不到指定的备份: ${backupName}`);
    }

    // 准备恢复脚本的输入
    const inputs = [
      backupType === "zips"
        ? "1"
        : backupType === "differential"
        ? "2"
        : backupType === "incremental"
        ? "3"
        : backupType === "snapshots"
        ? "4"
        : "1",
      "3", // 选择恢复整个世界
      "2", // 选择服务器
      "1", // 选择世界（假设为"world"）
      backupIndex.toString(), // 选择正确的备份
      "continue", // 确认继续
    ];

    // 执行恢复脚本
    const child = spawn("bash", [scriptPath], { cwd: minecraftServerPath });

    child.stdout.on("data", (data) => {
      console.log(`脚本输出: ${data}`);
      // 发送进度更新
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "progress", status: "running" }));
        }
      });
    });

    child.stderr.on("data", (data) => {
      console.error(`脚本错误: ${data}`);
    });

    for (const input of inputs) {
      child.stdin.write(input + "\n");
    }

    child.stdin.end();

    await new Promise((resolve, reject) => {
      child.on("close", (code) => {
        if (code === 0) {
          // 发送完成消息
          wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({ type: "progress", status: "completed" })
              );
            }
          });
          resolve();
        } else {
          reject(new Error(`脚本退出，代码: ${code}`));
        }
      });
    });

    res.json({ message: `备份 ${backupName} 已成功恢复` });
  } catch (err) {
    console.error(`恢复备份错误: ${err}`);
    return res.status(500).json({ error: "无法恢复备份: " + err.message });
  }
});

// 检查screen会话是否存在
const isScreenSessionExist = async (sessionName) => {
  try {
    const { stdout } = await execPromise(`screen -ls | grep ${sessionName}`);
    return stdout.trim() !== "";
  } catch (error) {
    return false;
  }
};

// 启动Minecraft服务器
app.post("/api/start-minecraft", authenticateToken, async (req, res) => {
  try {
    if (!minecraftServerPath) {
      await findMinecraftServerFolder();
    }

    // 首先检查服务器是否已经在运行
    const serverRunning = await isMinecraftRunning();
    if (serverRunning) {
      return res.json({ message: "Minecraft服务器已经在运行中" });
    }

    const sessionName = "mc";
    const jarPath = "fabric.jar";
    let startCommand;

    if (os.platform() === "darwin") {
      // macOS
      const javaPath = "/opt/homebrew/Cellar/openjdk@21/21.0.4/bin/java";
      startCommand = `${javaPath} -Xmx2G -jar ${jarPath} nogui`;
    } else {
      // Ubuntu 或其他 Linux 系统
      startCommand = `java -Xmx2G -jar ${jarPath} nogui`;
    }

    // 检查screen会话是否存在
    const sessionExists = await isScreenSessionExist(sessionName);

    if (sessionExists) {
      // 如果会话存在，尝试进入该会话并启动服务器
      try {
        await execPromise(
          `cd ${minecraftServerPath} && screen -r ${sessionName} -X stuff $'${startCommand}\n'`
        );
      } catch (error) {
        console.error(`无法在现有会话中启动服务器: ${error}`);
        // 如果在现有会话中启动失败，尝试创建新会话
        await execPromise(
          `cd ${minecraftServerPath} && screen -dmS ${sessionName} bash -c '${startCommand}'`
        );
      }
    } else {
      // 如果会话不存在，创建新会话并���动服务器
      await execPromise(
        `cd ${minecraftServerPath} && screen -dmS ${sessionName} bash -c '${startCommand}'`
      );
    }

    res.json({ message: "Minecraft服务器启动命令已发送" });
  } catch (error) {
    console.error(`启动Minecraft服务器时出错: ${error}`);
    res
      .status(500)
      .json({ error: "无法启动Minecraft服务器: " + error.message });
  }
});

// 修改：获取公网 IP 地址的函数
async function getPublicIP() {
  try {
    const response = await fetch("https://api.ipify.org?format=json");
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error("获取公网 IP 地址失败:", error);
    return "无法获取公网 IP";
  }
}

// 修改：API 端点，返回服务器公网 IP 地址
app.get("/api/server-info", authenticateToken, async (req, res) => {
  const publicIP = await getPublicIP();
  res.json({ ip: publicIP });
});

// 新增: 获取服务器状态的 API 端点
app.get("/api/server-status", authenticateToken, async (req, res) => {
  const { ip } = req.query;
  if (!ip) {
    return res.status(400).json({ error: "Missing IP parameter" });
  }

  try {
    const response = await fetch(`https://api.mcsrvstat.us/2/${ip}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("获取服务器状态失败:", error);
    res.status(500).json({ error: "无法获取服务器状态" });
  }
});

const server = app.listen(port, "0.0.0.0", () => {
  console.log(`服务器运行在 http://${getPublicIP()}:${port}`);
});

server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

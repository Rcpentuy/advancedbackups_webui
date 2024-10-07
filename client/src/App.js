import React, { useState, useEffect, useRef } from "react";
import axios from "axios";

function App() {
  const [backups, setBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [message, setMessage] = useState("");
  const [serverInfo, setServerInfo] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [serverStatus, setServerStatus] = useState("未知");
  const [playerCount, setPlayerCount] = useState(0);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const wsRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchServerInfo();
    } else {
      setIsLoggedIn(false);
    }

    // 添加 mc-player-counter 脚本
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/gh/leonardosnt/mc-player-counter/dist/mc-player-counter.min.js";
    script.async = true;
    document.body.appendChild(script);

    // 创建 WebSocket 连接
    wsRef.current = new WebSocket(`ws://${window.location.hostname}:3001`);

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "progress") {
        setRestoreProgress(Math.min(data.percentage, 100));
      }
    };

    return () => {
      document.body.removeChild(script);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`/api/login`, { password });
      if (response.data.success) {
        setIsLoggedIn(true);
        setMessage("");
        localStorage.setItem("token", response.data.token);
        axios.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${response.data.token}`;
        fetchServerInfo();
      } else {
        setMessage("登录失败：密码错误");
      }
    } catch (error) {
      console.error("登录失败:", error);
      setMessage("登录失败：密码错误");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setServerInfo(null);
    setBackups([]);
    setSelectedBackup(null);
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
  };

  const fetchServerInfo = async () => {
    try {
      const response = await axios.get("/api/server-info");
      setServerInfo(response.data);
      fetchBackups(response.data);
      updateServerStatus(response.data.ip);
    } catch (error) {
      console.error("获取服务器信息失败:", error);
      if (error.response && error.response.status === 401) {
        handleLogout();
      } else {
        setMessage("获取服务器信息失败");
      }
    }
  };

  const fetchBackups = async () => {
    try {
      const response = await axios.get(`/api/backups`);
      setBackups(response.data);
    } catch (error) {
      console.error("获取备份列表失败:", error);
      setMessage("获取备份列表失败");
    }
  };

  const stopMinecraft = async () => {
    try {
      const response = await axios.post(`/api/stop-minecraft`);
      setMessage(response.data.message);
    } catch (error) {
      console.error("停止Minecraft服务器失败:", error);
      setMessage("停止Minecraft服务器失败");
    }
  };

  const startMinecraft = async () => {
    try {
      const response = await axios.post(`/api/start-minecraft`);
      setMessage(response.data.message);
    } catch (error) {
      console.error("启动Minecraft服务器失败:", error);
      setMessage("启动Minecraft服务器失败");
    }
  };

  const restoreBackup = async () => {
    if (!selectedBackup) {
      setMessage("请先选择一个备份");
      return;
    }

    try {
      setRestoreProgress(0);
      const response = await axios.post(`/api/restore-backup`, selectedBackup);
      setMessage(response.data.message);
    } catch (error) {
      console.error("恢复备份失败:", error);
      setMessage("恢复备份失败");
    } finally {
      // 不要在这里重置进度，让它保持在100%
      // setRestoreProgress(0);
    }
  };

  const updateServerStatus = async (ip) => {
    try {
      const response = await axios.get(`/api/server-status?ip=${ip}`);
      setServerStatus(response.data.online ? "在线" : "离线");
      setPlayerCount(response.data.players.online);
    } catch (error) {
      console.error("获取服务器状态失败:", error);
      setServerStatus("未知");
      setPlayerCount(0);
    }
  };

  // 在每个API调用中添加错误处理
  const apiCall = async (func) => {
    try {
      await func();
    } catch (error) {
      console.error("API调用失败:", error);
      if (error.response && error.response.status === 401) {
        handleLogout();
      } else {
        setMessage("操作失败，请重试");
      }
    }
  };

  // 使用apiCall包装现有的API调用函数
  const wrappedStopMinecraft = () => apiCall(stopMinecraft);
  const wrappedStartMinecraft = () => apiCall(startMinecraft);
  const wrappedRestoreBackup = () => apiCall(restoreBackup);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
        <div className="relative py-3 sm:max-w-xl sm:mx-auto">
          <div className="px-4 py-10 bg-white shadow-lg sm:rounded-lg sm:p-20">
            <h1 className="text-4xl font-bold mb-8 text-center text-gray-800">
              登录
            </h1>
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-gray-700"
                >
                  密码
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                登录
              </button>
            </form>
            {message && (
              <p className="mt-4 text-center text-red-500 font-semibold">
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-4xl sm:mx-auto">
        <div className="px-4 py-10 bg-white shadow-lg sm:rounded-lg sm:p-20">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800">
              Minecraft 服务器管理
            </h1>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-110"
            >
              登出
            </button>
          </div>

          {serverInfo && (
            <div className="mb-8 bg-gray-50 p-4 rounded-lg shadow">
              <h2 className="text-2xl font-semibold mb-2 text-gray-700">
                服务器状态
              </h2>
              <p>状态: {serverStatus}</p>
              <p>IP: {serverInfo.ip}</p>
              <p>
                在线玩家:{" "}
                <span data-playercounter-ip={`${serverInfo.ip}`}>
                  {playerCount}
                </span>
              </p>
            </div>
          )}

          <div className="mb-8 flex justify-center space-x-4">
            <button
              onClick={wrappedStartMinecraft}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-110"
            >
              启动服务器
            </button>
            <button
              onClick={wrappedStopMinecraft}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-110"
            >
              停止服务器
            </button>
          </div>

          <h2 className="text-2xl font-semibold mb-4 text-gray-700">
            备份列表
          </h2>
          {backups.map((backup, index) => (
            <div key={index} className="mb-6 bg-gray-50 p-4 rounded-lg shadow">
              <h3 className="font-semibold text-lg mb-2 text-gray-800">
                {backup.path}
              </h3>
              {["zips", "differential", "incremental", "snapshots"].map(
                (type) => (
                  <div key={type} className="mb-4">
                    <h4 className="font-medium text-gray-700 mb-2">{type}</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      {backup[type].map((file, fileIndex) => (
                        <li key={fileIndex}>
                          <button
                            onClick={() =>
                              setSelectedBackup({
                                backupName: file,
                                backupType: type,
                                backupPath: backup.path,
                              })
                            }
                            className="text-blue-500 hover:text-blue-700 transition duration-300 ease-in-out"
                          >
                            {file}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              )}
            </div>
          ))}

          {selectedBackup && (
            <div className="mt-8 bg-blue-50 p-4 rounded-lg shadow">
              <h3 className="font-semibold text-lg mb-2 text-gray-800">
                已选择的备份：
              </h3>
              <p className="mb-4 text-gray-700">
                {selectedBackup.backupName} ({selectedBackup.backupType})
              </p>
              <button
                onClick={wrappedRestoreBackup}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out transform hover:-translate-y-1 hover:scale-110"
              >
                恢复此备份
              </button>
              {restoreProgress > 0 && (
                <div className="mt-4">
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${restoreProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-center mt-2">{restoreProgress}%</p>
                </div>
              )}
            </div>
          )}

          {message && (
            <p className="mt-6 text-center text-red-500 font-semibold">
              {message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;

import React, { useState, useEffect } from "react";
import axios from "axios";

function App() {
  const [backups, setBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [message, setMessage] = useState("");
  const [serverInfo, setServerInfo] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [consoleOutput, setConsoleOutput] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      setIsLoggedIn(true);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchServerInfo();
    }
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
      setMessage("登录失败：服务器错误");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("token");
    delete axios.defaults.headers.common["Authorization"];
  };

  const fetchServerInfo = async () => {
    try {
      const response = await axios.get("/api/server-info");
      setServerInfo(response.data);
      fetchBackups(response.data);
    } catch (error) {
      console.error("获取服务器信息失败:", error);
      setMessage("获取服务器信息失败");
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
      const response = await axios.post(`/api/restore-backup`, selectedBackup);
      setMessage(response.data.message);
    } catch (error) {
      console.error("恢复备份失败:", error);
      setMessage("恢复备份失败");
    }
  };

  // 新增：获取控制台输出
  const fetchConsoleOutput = async () => {
    try {
      const response = await axios.get("/api/console-output");
      setConsoleOutput(response.data.output);
    } catch (error) {
      console.error("获取控制台输出失败:", error);
    }
  };

  // 每5秒更新一次控制台输出
  useEffect(() => {
    if (isLoggedIn) {
      const interval = setInterval(fetchConsoleOutput, 5000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  // 在 useEffect 钩子中添加自动滚动功能
  useEffect(() => {
    const consoleElement = document.getElementById("console-output");
    if (consoleElement) {
      consoleElement.scrollTop = consoleElement.scrollHeight;
    }
  }, [consoleOutput]);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
        <div className="relative py-3 sm:max-w-xl sm:mx-auto">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-light-blue-500 shadow-lg transform -skew-y-6 sm:skew-y-0 sm:-rotate-6 sm:rounded-3xl"></div>
          <div className="relative px-4 py-10 bg-white shadow-lg sm:rounded-3xl sm:p-20">
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
    <div className="min-h-screen bg-gray-100 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold text-gray-800">
                Minecraft 服务器管理
              </h1>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out"
              >
                登出
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <div className="mb-6 flex justify-center space-x-4">
                  <button
                    onClick={startMinecraft}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out"
                  >
                    启动服务器
                  </button>
                  <button
                    onClick={stopMinecraft}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out"
                  >
                    停止服务器
                  </button>
                </div>

                <h2 className="text-xl font-semibold mb-4 text-gray-700">
                  备份列表
                </h2>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {backups.map((backup, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 p-4 rounded-lg shadow"
                    >
                      <h3 className="font-semibold text-lg mb-2 text-gray-800">
                        {backup.path}
                      </h3>
                      {["zips", "differential", "incremental", "snapshots"].map(
                        (type) => (
                          <div key={type} className="mb-2">
                            <h4 className="font-medium text-gray-700 mb-1">
                              {type}
                            </h4>
                            <ul className="list-disc pl-5 space-y-1 text-sm">
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
                </div>

                {selectedBackup && (
                  <div className="mt-6 bg-blue-50 p-4 rounded-lg shadow">
                    <h3 className="font-semibold text-lg mb-2 text-gray-800">
                      已选择的备份：
                    </h3>
                    <p className="mb-4 text-gray-700">
                      {selectedBackup.backupName} ({selectedBackup.backupType})
                    </p>
                    <button
                      onClick={restoreBackup}
                      className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out"
                    >
                      恢复此备份
                    </button>
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">
                  控制台输出
                </h2>
                <div
                  id="console-output"
                  className="bg-black text-green-400 p-4 rounded-lg h-96 overflow-y-auto font-mono text-sm"
                >
                  {consoleOutput.map((line, index) => (
                    <div key={index}>{line}</div>
                  ))}
                </div>
              </div>
            </div>

            {message && (
              <p className="mt-6 text-center text-red-500 font-semibold">
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

import React, { useState, useEffect } from "react";
import axios from "axios";

function App() {
  const [backups, setBackups] = useState([]);
  const [selectedBackup, setSelectedBackup] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    try {
      const response = await axios.get("http://localhost:3001/api/backups");
      setBackups(response.data);
    } catch (error) {
      console.error("获取备份列表失败:", error);
      setMessage("获取备份列表失败");
    }
  };

  const stopMinecraft = async () => {
    try {
      const response = await axios.post(
        "http://localhost:3001/api/stop-minecraft"
      );
      setMessage(response.data.message);
    } catch (error) {
      console.error("停止Minecraft服务器失败:", error);
      setMessage("停止Minecraft服务器失败");
    }
  };

  const startMinecraft = async () => {
    try {
      const response = await axios.post(
        "http://localhost:3001/api/start-minecraft"
      );
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
      const response = await axios.post(
        "http://localhost:3001/api/restore-backup",
        selectedBackup
      );
      setMessage(response.data.message);
    } catch (error) {
      console.error("恢复备份失败:", error);
      setMessage("恢复备份失败");
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Minecraft 服务器管理</h1>

      <div className="mb-4">
        <button
          onClick={startMinecraft}
          className="bg-green-500 text-white px-4 py-2 rounded mr-2"
        >
          启动服务器
        </button>
        <button
          onClick={stopMinecraft}
          className="bg-red-500 text-white px-4 py-2 rounded"
        >
          停止服务器
        </button>
      </div>

      <h2 className="text-xl font-semibold mb-2">备份列表</h2>
      {backups.map((backup, index) => (
        <div key={index} className="mb-4">
          <h3 className="font-semibold">{backup.path}</h3>
          {["zips", "differential", "incremental", "snapshots"].map((type) => (
            <div key={type}>
              <h4 className="font-medium">{type}</h4>
              <ul className="list-disc pl-5">
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
                      className="text-blue-500 hover:underline"
                    >
                      {file}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}

      {selectedBackup && (
        <div className="mt-4">
          <h3 className="font-semibold">已选择的备份：</h3>
          <p>
            {selectedBackup.backupName} ({selectedBackup.backupType})
          </p>
          <button
            onClick={restoreBackup}
            className="bg-blue-500 text-white px-4 py-2 rounded mt-2"
          >
            恢复此备份
          </button>
        </div>
      )}

      {message && <p className="mt-4 text-red-500">{message}</p>}
    </div>
  );
}

export default App;

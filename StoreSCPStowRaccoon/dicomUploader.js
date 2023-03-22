const fs = require('fs');
const path = require('path');
const os = require('os');
const uuid = require('uuid');

const { stowFolder } = require("./stowStandalone/stowStandalone");
var randomStr = "";
const dicomDir = './dicomFiles/'; // 指定Dicom目錄
var tempDir = ""; // 建立隨機產生的暫存目錄

// 遞歸遍歷目錄下的所有Dicom文件，將它們移動到暫存目錄
function moveDicomFilesToTempDir(dirPath) {
  fs.readdirSync(dirPath).forEach(file => {
    const filePath = path.join(dirPath, file);
    if (fs.statSync(filePath).isDirectory()) {
      moveDicomFilesToTempDir(filePath);
    } else {
      // 使用uuid模組生成唯一的檔名，然後將Dicom文件移動到暫存目錄中
      const newFileName = `${uuid.v4()}.dcm`;
      console.log("moving:" + filePath + "->" + newFileName);
      fs.renameSync(filePath, path.join(tempDir, newFileName));
    }
  });
}
// 將暫存目錄下的所有Dicom文件儲存到伺服器
async function storeDicomFilesInTempDir() {
  await stowFolder(tempDir);
}

// 刪除暫存目錄及其中的所有文件
function deleteTempDir() {
  fs.rmdirSync(tempDir, { recursive: true });
}

async function main() {
	// 執行程序
	randomStr = uuid.v4();
	tempDir = path.join('./temp/', `dicom_${randomStr}`);
	// 創建暫存目錄，如果不存在的話
	if (!fs.existsSync(tempDir)) {
		console.log("creating folder:" + tempDir);
		fs.mkdirSync(tempDir);
	}
	moveDicomFilesToTempDir(dicomDir); // 移動Dicom文件到暫存目錄
	await storeDicomFilesInTempDir(); // 儲存所有暫存目錄Dicom文件
	//deleteTempDir(); // 刪除暫存目錄及其中的所有文件
}

main();
const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('request');
const uuid = require('uuid');

const dicomDir = './dicomFiles/'; // 指定Dicom目錄
const tempDir = path.join('./temp/', `dicom_${Math.random().toString(36).substring(2)}`); // 建立隨機產生的暫存目錄

// 遞歸遍歷目錄下的所有Dicom文件，將它們移動到暫存目錄
function moveDicomFilesToTempDir(dirPath) {
  fs.readdirSync(dirPath).forEach(file => {
    const filePath = path.join(dirPath, file);
		console.log(filePath);
    if (fs.statSync(filePath).isDirectory()) {
      moveDicomFilesToTempDir(filePath);
    } else {
      // 創建暫存目錄，如果不存在的話
      if (!fs.existsSync(tempDir)) {
		console.log("creating folder:" + tempDir);
        fs.mkdirSync(tempDir);
      }
      // 使用uuid模組生成唯一的檔名，然後將Dicom文件移動到暫存目錄中
      const newFileName = `${uuid.v4()}.dcm`;
	  console.log("moving:" + filePath + "->" + newFileName);
      fs.renameSync(filePath, path.join(tempDir, newFileName)); 
    }
  });
}

// 上傳Dicom文件到伺服器
async function uploadDicomFile(filePath) {
  const url = 'http://localhost:80/dicom-web/studies'; // 指定StowRS伺服器的URL
  const formData = {
    file: fs.createReadStream(filePath)
  };
  console.log("Uploading:" + filePath);
  return new Promise((resolve, reject) => {
    request.post({ url, formData }, (err, httpResponse, body) => {
      if (err) {
        reject(err);
      } else {
		console.log(body);
        resolve(body);
      }
    });
  });
}

// 上傳暫存目錄下的所有Dicom文件到伺服器
async function uploadDicomFilesInTempDir() {
  const files = await fs.promises.readdir(tempDir);
  for (const file of files) {
    const filePath = path.join(tempDir, file);
    try {
      await uploadDicomFile(filePath); // 上傳Dicom文件到伺服器
      await fs.promises.unlink(filePath); // 刪除已上傳的Dicom文件
    } catch (err) {
      console.error(`Error uploading file ${filePath}: ${err}`);
    }
  }
}

// 刪除暫存目錄及其中的所有文件
function deleteTempDir() {
  fs.rmdirSync(tempDir, { recursive: true });
}

async function main() {
	// 執行程序
	moveDicomFilesToTempDir(dicomDir); // 移動Dicom文件到暫存目錄
	await uploadDicomFilesInTempDir();
	deleteTempDir(); // 刪除暫存目錄及其中的所有文件
}

main();
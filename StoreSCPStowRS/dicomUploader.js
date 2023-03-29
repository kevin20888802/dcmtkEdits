const fs = require('fs');
const path = require('path');
const { spawn } = require('node:child_process');

const request = require('request');
const uuid = require('uuid');

const AETitle = "MYSTORESCP";
const Port = 6066;
const stowRSUrl = 'http://10.40.8.76:80/dicom-web/studies';
const dicomDir = './dicomFiles'; // 指定Dicom目錄
var tempDir = "./temp/"; // 建立隨機產生的暫存目錄

// 遞歸遍歷目錄下的所有Dicom文件，將它們移動到暫存目錄
function moveDicomFilesToTempDir(dirPath) {
  let fileList = readDirFiles(dirPath);
  for(let i = 0; i < fileList.length; i++) {
    const filePath = fileList[i];
    console.log(filePath);
    if(fs.existsSync(filePath)) {
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
        if(fs.existsSync(filePath)) {
          fs.renameSync(filePath, path.join(tempDir, newFileName)); 
        }
      }
    }
  }
}

// 將資料夾所有檔案路徑產生一個陣列存放
function readDirFiles(dir) {
  var results = [];
  var list = fs.readdirSync(dir);
  list.forEach(function(file) {
      file = dir + '/' + file;
      var stat = fs.statSync(file);
      if (stat && stat.isDirectory()) { 
          /* Recurse into a subdirectory */
          results = results.concat(readDirFiles(file));
      } else { 
          /* Is a file */
          results.push(file);
      }
  });
  return results;
}

// 上傳Dicom文件到伺服器
async function uploadDicomFile(filePath) {
  const url = stowRSUrl; // 指定StowRS伺服器的URL
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
  fs.readdir(tempDir, (err, files) => {
    if (err) throw err;
  
    for (const file of files) {
      fs.unlink(path.join(tempDir, file), (err) => {
        if (err) throw err;
      });
    }
  });
}

// 等待sleep
function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// 每秒執行檢查是否資料夾內有檔案如果有就上傳
async function onEverySec() {
  // 執行程序
	tempDir = path.join('./temp/', `dicom_tmpfile`);
	// 創建暫存目錄，如果不存在的話
	if (!fs.existsSync(tempDir)) {
		console.log("creating folder:" + tempDir);
		fs.mkdirSync(tempDir);
	}
  // 移動Dicom文件到暫存目錄
	moveDicomFilesToTempDir(dicomDir); 
	await uploadDicomFilesInTempDir();
  // 刪除暫存目錄及其中的所有文件
	deleteTempDir(); 
  await sleep(1000);
  console.log("one sec passed.");
  await onEverySec();
}

async function startStoreSCP() {
  const dcmService = spawn(`./storescp`,["-aet", AETitle , "-od", "./dicomFiles", Port]);
  dcmService.stdout.on('data', (data) => onDCMOutput(data));
}

function onDCMOutput(data) {
  console.log("[storeSCP]" + data);
}
startStoreSCP();
onEverySec();
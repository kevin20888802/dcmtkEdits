# RaccoonSCP plugin
### This is a [SCP](#關於scpservice-class-provider) project allow you to send dicom images via [C-STORE](#關於c-store) protocol and store data in [Raccoon](https://github.com/cylab-tw/raccoon)

## Requirements
### Please make sure you have deployed [Raccoon](https://github.com/cylab-tw/raccoon)

### If not, you can follow this document to Deploy Raccoon
+ https://github.com/cylab-tw/raccoon#installation

<image src="https://repository-images.githubusercontent.com/314441601/8e680180-33da-11eb-8da5-266f5636f213" width="50%"></image>

## Installation
### Step1-Clone this Repo
```
git clone https://github.com/kevin20888802/dcmtkEdits.git
```

### Step2-install project dependency packages
```
cd dcmtkEdits/StoreSCPStowRS
npm install
```

### Step3-install dcmtk tools
#### Windows (Run Terminal as Administrator)
```
choco install dcmtk -y
```

> ⚠️ **If you have not installed chocolatey on your Windows, use the follow command to do so.** (❗Run Terminal as Administrator❗)
```
@"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -InputFormat None -ExecutionPolicy Bypass -Command "iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))" && SET "PATH=%PATH%;%ALLUSERSPROFILE%\chocolatey\bin"
```
> Command soure: https://community.chocolatey.org/courses/installation/installing?method=installing-chocolatey


#### Linux
```
sudo apt update
sudo apt-get install dcmtk -y
```

### Step4-Modify Configs in `dicomUploader.js`
```js=
const AETitle = "RACCOON_SCP"; //可以更改為其他AE title
const Port = 6066; // 設定此插件要運行在哪個port
const stowRSUrl = 'http://127.0.0.1:8081/dicom-web/studies'; // 設定為你Raccoon的api網址
const dicomDir = './dicomFiles'; // 指定Dicom目錄
var tempDir = "./temp/"; // 建立隨機產生的暫存目錄
```

### Step5-Run this plugin
```
cd dcmtkEdits/StoreSCPStowRS
node dicomUploader.js
# Or you may use pm2 to start this project
```

## 關於SCP(Service Class Provider)
SCP (Service Class Provider) 是指一種提供 DICOM 服務的實體，可以接收和處理 DICOM 操作（如 C-STORE、C-FIND、C-MOVE 等）。SCP 可以是 PACS 伺服器、影像檢視工作站或其他 DICOM 設備。SCP 主要用於接收和處理其他 DICOM 設備發送的影像和資訊。

在 DICOM 標準中，C-STORE 協定用於將影像傳輸到 SCP 上。因此，SCP 可以用於接收和處理由其他 DICOM 設備發送的影像和相關資訊。SCP 不僅可以用於傳輸 DICOM 影像，還可以用於傳輸其他類型的 DICOM 資訊，例如報告、患者資料等。

總之，SCP 是一種實體，可以用來接收和處理其他 DICOM 設備發送的影像和資訊，並且可以用於傳輸 DICOM 影像。

> 資料來源:20230407詢問ChatGPT Mar 23 Version

## 關於C-STORE
PACS 使用的傳輸協定包括 TCP/IP（Transmission Control Protocol/Internet Protocol）和 DICOM 上層協定，例如 C-STORE、C-FIND、C-MOVE 和 C-GET 等。其中，C-STORE 協定用於傳輸影像資料，C-FIND 協定用於查詢影像資料，C-MOVE 協定用於從 PACS 檔案庫中檢索影像資料，C-GET 協定用於獲取影像資料。這些協定是 DICOM 標準的一部分，用於實現醫學影像的傳輸和共享。

其中C-STORE 是一種 DICOM 傳輸協定。C-STORE（存儲）是 DICOM 的一個服務類別，用於將影像和相關資訊傳輸到 PACS 中的儲存設備上。C-STORE 協定使用 TCP/IP 網路協定進行傳輸，並且需要在傳輸前建立一個 DICOM 連接。在傳輸期間，影像和相關資訊會被打包成 DICOM 媒體物件，然後通過 C-STORE 協定傳輸到接收方（通常是 PACS 伺服器）上。

C-STORE 協定是 DICOM 標準中的一個重要部分，用於實現影像和相關資訊的傳輸和共享。在 DICOM 環境中，許多設備都支持 C-STORE 協定，包括 PACS 伺服器、影像檢視工作站、DICOM 影像儀器等。
> 資料來源:20230407詢問ChatGPT Mar 23 Version
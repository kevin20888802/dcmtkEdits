const dicomParser = require('dicom-parser');
const moveFile = require("move-file");
const fs = require('fs');
const _ = require("lodash"); 

const DICOMWEB_API = "dicom-web";

/**
 * 將指定路徑的dicom轉json。
 * @param {*} dicomFilePath 
 * @returns 
 */
function convertDicomToJson(dicomFilePath) {
  // 讀取DICOM檔案的二進制數據
  const dicomData = fs.readFileSync(dicomFilePath);
  // 解析DICOM數據
  const dataSet = dicomParser.parseDicom(dicomData);
  // 將解析後的數據轉換為JSON格式
  const jsonData = dataSet.elements.reduce((result, element) => {
    result[element.tag] = element.value;
    return result;
  }, {});
  // 返回JSON格式的數據
  return jsonData;
}

/**
 *
 * @param {string} tempFilename 暫存
 * @param {string} filename 上傳
 * @param {*} dest 目標路徑
 * @returns
 */
async function saveDICOMFile(tempFilename, filename, dest) {
    try {
        let destWithFilename = path.join(dest, filename);
        logger.info(
            `[STOW] [Move uploaded temp file ${tempFilename} to ${destWithFilename}]`
        );
        await moveFile(tempFilename, destWithFilename, {
            overwrite: true
        });
        return {
            status: true,
            error: undefined,
            storeFullPath: destWithFilename
        };
    } catch (e) {
        console.error(e);
        return {
            status: false,
            storeFullPath: undefined,
            error: e
        };
    }
}

// 從json中取得資料
function detachBigValuesDicomJson(dicomJson) {
    // Temp the tags that may have big complex structure
    let bigValueTags = ["52009230", "00480200"];
    let tempBigTagValue = {};
    for (let bigValueTag of bigValueTags) {
        let bigValue = _.get(dicomJson, bigValueTag);
        if (bigValue) {
            _.set(tempBigTagValue, `${bigValueTag}`, _.cloneDeep(bigValue));
        } else {
            _.set(tempBigTagValue, `${bigValueTag}`, undefined);
        }
        bigValue = undefined;
    }

    dicomJson = _.omit(dicomJson, bigValueTags);

    return {
        dicomJson: dicomJson,
        tempBigTagValue: tempBigTagValue
    };
}
function getUidObj(dicomJson) {
    let studyUID = _.get(dicomJson, `0020000D.Value.0`);
    let seriesUID = _.get(dicomJson, `0020000E.Value.0`);
    let instanceUID = _.get(dicomJson, `00080018.Value.0`);
    let sopClass = _.get(dicomJson, `00080016.Value.0`);
    return {
        studyUID: studyUID,
        seriesUID: seriesUID,
        instanceUID: instanceUID,
        sopClass: sopClass
    };
}
function getRetrieveUrlObj(req, uidObj) {
    let { studyUID, seriesUID, instanceUID } = uidObj;
    return {
        studyRetrieveUrl: `http://${req.headers.host}/${DICOMWEB_API}/studies/${studyUID}`,
        seriesRetrieveUrl: `http://${req.headers.host}/${DICOMWEB_API}/studies/${studyUID}/series/${seriesUID}`,
        instanceRetrieveUrl: `http://${req.headers.host}/${DICOMWEB_API}/studies/${studyUID}/series/${seriesUID}/instances/${instanceUID}`
    };
}

/**
 *  1.將 DICOM 轉換為 JSON 格式。
    2.如果沒有衝突的 Study UID，或者在將 DICOM 轉換為 FHIR ImagingStudy 物件時沒有錯誤，則儲存 DICOM 檔案。
    3.將 DICOM 轉換為 FHIR ImagingStudy 物件。
    4.合併 DICOM JSON 和 FHIR ImagingStudy 物件。
    5.從 MongoDB 中取得合併後的 ImagingStudy 物件，或者創建新的 FHIR ImagingStudy 實例。
    6.更新 MongoDB 中的 FHIR 終端、患者和 ImagingStudy。
    7.計算所有 Modality in Study 並更新到 MongoDB 中。
    這個函式接收兩個參數：filename 和 originalFilename。
    filename 和 originalFilename 是上傳的 DICOM 檔案的暫存和原始檔案名稱。
 */
async function stow(filename, originalFilename) {
    // 1.將 DICOM 轉換為 JSON 格式。
    let dicomJson = convertDicomToJson(filename);

    // 1.1 取得json中的uid和url
    let dicomJsonAndBigTags = detachBigValuesDicomJson(dicomJson);
    let uidObj = getUidObj(dicomJson);
    let retrieveUrlObj = getRetrieveUrlObj(req, uidObj);

    // 2.如果沒有衝突的 Study UID，或者在將 DICOM 轉換為 FHIR ImagingStudy 物件時沒有錯誤，則儲存 DICOM 檔案。
    let storedDICOMObject = await saveDICOMFile(
        filename,
        originalFilename,
        fullStorePath
    );
    if (!storedDICOMObject.status) {
        console.error(`Can not save DICOM file ${JSON.stringify(uidObj)}`);
        return {
            isFailure: true,
            statusCode: 272,
            message: "Can not save DICOM file",
            uidObj: uidObj,
            retrieveUrlObj: retrieveUrlObj,
            httpStatusCode: 500
        };
    }
}
/**
 * 將Raccoon中Stow的功能獨立出來，
 * 好讓storescp可以單獨執行stow的動作，
 * 不需要再額外經過一次RS的http，
 * 直接存取檔案及MongoDB。
 */
require('dotenv').config();
const path = require("path");
const fs = require('fs');

const fhirImagingStudyModel = require("./models/FHIR/DICOM2FHIRImagingStudy");

const {convertDICOMFileToJSONModule} = require('./api/convertDICOMFileToJSONModule');
const {saveDICOMFile} = require("./api/saveDICOMFile");
const {getFHIRIntegrateDICOMJson} = require("./api/getFHIRIntegrateDICOMJson");
const {dicom2FHIR} = require("./api/dicom2FHIR");
const {dicom2mongodb} = require("./api/dicom2mongodb");

/**
 * stow儲存某個dicom檔案
 */
module.exports.stow = async function(filename) {
    return await stow(filename);
};

/**
 * 將整個資料夾裡面的每個dicom都stow儲存到伺服器。
 */
module.exports.stowFolder = async function(folder)
{
    const files = await fs.promises.readdir(folder);
    for (const file of files) {
      const filePath = path.join(folder, file);
      try {
        await stow(filePath); // 儲存Dicom文件到伺服器 (stow的過程會直接將檔案移動到正確位置)
      } catch (err) {
        console.error(`Error saving file ${filePath}: ${err}`);
      }
    }
}

/**
 * stow儲存某個dicom檔案
 */
async function stow(filename) {
    try {
        // Step 1 DICOM to JSON
        let dicomToJsonResponse = await convertDICOMFileToJSONModule(filename);
        if (!dicomToJsonResponse.status) {
            console.error(
                `The server have exception with file:${filename} , error : can not convert DICOM to JSON Module`
            );
            return false;
        }

        // Step 2 儲存DICOM檔案
        let storedDICOMObject = await saveDICOMFile(
            filename,
            path.basename(filename),
            dicomToJsonResponse.storeFullPath
        );
        
        // 如果檔案儲存成功
        if (storedDICOMObject.status) {
            // Step 3 將DICOM JSON轉成FHIR JSON
            let fhirImagingStudyData =
                await fhirImagingStudyModel.DCMJson2FHIR(
                    dicomToJsonResponse.dicomJson
                );
            if (!fhirImagingStudyData) {
                console.error(
                    `The server have exception with file:${filename} , error : can not convert DICOM to FHIR ImagingStudy`
                );
                return false;
            }

            // Step 4 將endpoint存入資料庫
            let fhirDICOM = await getFHIRIntegrateDICOMJson(
                dicomToJsonResponse.dicomJson,
                storedDICOMObject.storeFullPath,
                fhirImagingStudyData
            );
            if (!fhirDICOM) {
                console.error(
                    `The server have exception with file:${filename} , error : can not integrate FHIR with DICOM JSON`
                );
                return false;
            }
            fhirDICOM.series[0].instance[0].store_path = path.join(
                dicomToJsonResponse.storePath,
                path.basename(filename)
            );

            // Step 5 將FHIR ImagingStudy儲存到資料庫
            let fhirMerge = await dicom2FHIR(fhirDICOM);
            if (!fhirMerge) {
                console.error(
                    `The server have exception with file:${filename} , error : can not store FHIR ImagingStudy object to database`
                );
                return false;
            }

            // Step 6 dicom儲存
            let storeToMongoDBStatus = await dicom2mongodb(fhirMerge);
            if (!storeToMongoDBStatus) {
                console.error(
                    `The server have exception with file:${filename} , error : can not store object to database`
                );
                return false;
            }
            return true;
        } else {
            console.error(
                `The server have exception with file:${filename} , error : can not convert DICOM to JSON Module`
            );
            return false;
        }
    } catch (err) {
        let errMsg = err.message || err;
        console.log('"STOW Api" err, ', errMsg);
        return false;
    }
}

/** 測試用
async function main() {
	let args = process.argv.slice(2);
    let result = await stow(args[0]);
    console.log(result);
    process.exit();
}

main();
*/
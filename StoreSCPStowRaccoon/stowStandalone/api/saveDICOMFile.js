/**
 * 將DICOM實際檔案儲存(移動到儲存位置)
 */
const path = require("path");
const fileFunc = require("../models/file/file_Func");
const fs = require("fs");

/**
 *
 * @typedef saveDICOMFileReturnObject
 * @property {Boolean} status
 * @property {string} storeFullPath
 * @property {Object} error
 */

/**
 *
 * @param {string} tempFilename
 * @param {string} filename
 * @param {string} dest
 * @return {Promise<saveDICOMFileReturnObject>}
 */
module.exports.saveDICOMFile = async function (tempFilename, filename, dest) {
    try {
        await fileFunc.mkdir_Not_Exist(dest);
        let destWithFilename = path.join(dest, filename);
        console.log(
            `[STOW] [Move uploaded temp file ${tempFilename} to ${destWithFilename}]`
        );
        fs.renameSync(tempFilename, destWithFilename, {
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
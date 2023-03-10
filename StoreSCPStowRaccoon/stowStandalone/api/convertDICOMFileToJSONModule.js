/**
 * 將DICOM轉換成JSON
 */

const {
    dcm2jsonV8
} = require("../models/dcmtk");
const fs = require("fs");
const _ = require("lodash");
const flat = require("flat");
const sh = require("shorthash");
const path = require("path");
const mongodb = require("../models/mongodb");
const moment = require("moment");

/**
 * @typedef convertDICOMFileToJSONModuleReturnObject
 * @property {Boolean} status
 * @property {string} storePath
 * @property {string} storeFullPath
 * @property {Object} dicomJson
 */

/**
 * 將DICOM轉換成JSON
 * @param {string} filename
 * @return {Promise<convertDICOMFileToJSONModuleReturnObject>}
 */
module.exports.convertDICOMFileToJSONModule = async function(filename) {
    try {
        let dicomJson = await dcm2jsonV8.exec(filename);
        flat(dicomJson);
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
        dicomJson = await replaceBinaryData(dicomJson);
        let startedDate = "";
        startedDate =
            dcm2jsonV8.dcmString(dicomJson, "00080020") +
            dcm2jsonV8.dcmString(dicomJson, "00080030");
        if (!startedDate) startedDate = moment().toISOString();
        else startedDate = moment(startedDate, "YYYYMMDDhhmmss").toISOString();
        let startedDateSplit = startedDate.split("-");
        let year = startedDateSplit[0];
        let month = startedDateSplit[1];
        let uid = dcm2jsonV8.dcmString(dicomJson, "0020000E");
        let shortUID = sh.unique(uid);
        let relativeStorePath = `files/${year}/${month}/${shortUID}/`;
        let fullStorePath = path.join(
            process.env.DICOM_STORE_ROOTPATH,
            relativeStorePath
        );
        let instanceUID = dcm2jsonV8.dcmString(dicomJson, "00080018");
        let metadataFullStorePath = path.join(
            fullStorePath,
            `${instanceUID}.metadata.json`
        );

        for (let keys in tempBigTagValue) {
            if (tempBigTagValue[keys]) {
                _.set(dicomJson, keys, tempBigTagValue[keys]);
            }
        }
        if(!fs.existsSync(fullStorePath)) {
            fs.mkdirSync(fullStorePath, 0o755);
        }
        fs.writeFileSync(
            metadataFullStorePath,
            JSON.stringify(dicomJson, null, 4)
        );
        console.log(
            `[STOW] [Store metadata of DICOM json to ${metadataFullStorePath}]`
        );
        dicomJson = _.omit(dicomJson, bigValueTags);
        return {
            status: true,
            storePath: relativeStorePath,
            storeFullPath: fullStorePath,
            dicomJson: dicomJson
        };
    } catch (e) {
        console.error(e);
        return {
            status: false,
            storePath: undefined,
            storeFullPath: undefined,
            dicomJson: undefined
        };
    }
}

async function replaceBinaryData(data) {
    try {
        let binaryKeys = [];
        let flatDicomJson = flat(data);
        for (let key in flatDicomJson) {
            if (key.includes("7FE00010")) continue;
            if (flatDicomJson[key] == "OW" || flatDicomJson[key] == "OB") {
                binaryKeys.push(key.substring(0, key.lastIndexOf(".vr")));
            }
        }
        let port = process.env.DICOMWEB_PORT || "";
        port = port ? `:${port}` : "";
        for (let key of binaryKeys) {
            let studyUID = _.get(data, `0020000D.Value.0`);
            let seriesUID = _.get(data, `0020000E.Value.0`);
            let instanceUID = _.get(data, `00080018.Value.0`);
            let binaryData = "";
            let binaryValuePath = "";
            let shortInstanceUID = sh.unique(instanceUID);
            let relativeFilename = `files/bulkData/${shortInstanceUID}/`;
            if (_.get(data, `${key}.Value.0`)) {
                binaryValuePath = `${key}.Value.0`;
                binaryData = _.get(data, binaryValuePath);
                data = _.omit(data, [`${key}.Value`]);
                _.set(
                    data,
                    `${key}.BulkDataURI`,
                    `http://${process.env.DICOMWEB_HOST}${port}/${process.env.DICOMWEB_API}/studies/${studyUID}/series/${seriesUID}/instances/${instanceUID}/bulkdata/${binaryValuePath}`
                );
                relativeFilename += `${binaryValuePath}.raw`;
            } else if (_.get(data, `${key}.InlineBinary`)) {
                binaryValuePath = `${key}.InlineBinary`;
                binaryData = _.get(data, `${binaryValuePath}`);
                data = _.omit(data, [`${binaryValuePath}`]);
                _.set(
                    data,
                    `${key}.BulkDataURI`,
                    `http://${process.env.DICOMWEB_HOST}${port}/${process.env.DICOMWEB_API}/studies/${studyUID}/series/${seriesUID}/instances/${instanceUID}/bulkdata/${binaryValuePath}`
                );
                relativeFilename += `${binaryValuePath}.raw`;
            }
            let filename = path.join(
                process.env.DICOM_STORE_ROOTPATH,
                relativeFilename
            );
            if(!fs.existsSync(path.join(process.env.DICOM_STORE_ROOTPATH,`files/bulkData/${shortInstanceUID}`))) {
                fs.mkdirSync(
                    path.join(process.env.DICOM_STORE_ROOTPATH,`files/bulkData/${shortInstanceUID}`),
                    {recursive:true}
                );
            }
            console.log(`[STOW] [Store binary data to ${filename}]`);
            fs.writeFileSync(filename, Buffer.from(binaryData, "base64"));
            let bulkData = {
                studyUID: studyUID,
                seriesUID: seriesUID,
                instanceUID: instanceUID,
                filename: relativeFilename,
                binaryValuePath: binaryValuePath
            };

            await mongodb["dicomBulkData"].updateOne(
                {
                    $and: [
                        {
                            instanceUID: instanceUID
                        },
                        {
                            binaryValuePath: binaryValuePath
                        }
                    ]
                },
                bulkData,
                {
                    upsert: true
                }
            );
        }
        data["7FE00010"] = {
            vr: "OW",
            BulkDataURI: `http://${process.env.DICOMWEB_HOST}${port}/${process.env.DICOMWEB_API}/studies/${data["0020000D"].Value[0]}/series/${data["0020000E"].Value[0]}/instances/${data["00080018"].Value[0]}`
        };
        return data;
    } catch (e) {
        console.error(e);
        throw e;
    }
}
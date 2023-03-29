const {storeImagingStudy} = require("./storeImagingStudy");

/**
 * DICOM JSON轉 FHIR
 * @param {*} data 
 * @returns 
 */
module.exports.dicom2FHIR = async function(data) {
    return new Promise(async (resolve, reject) => {
        let resData = await storeImagingStudy(data.id, data);
        return resolve(resData);
    });
}

/**
 * 將ImagingStudy存入資料庫
 */
const mongodb = require("../models/mongodb");

module.exports.dicom2mongodb = async function (data) {
    return new Promise(async (resolve) => {
        console.log(`[STOW] [Store ImagingStudy, ID: ${data.id}]`);
        let result = await putFHIRImagingStudyWithoutReq(data.id, data);
        if (result) return resolve(true);
        return resolve(false);
    });
}

async function putFHIRImagingStudyWithoutReq(id , data) {
    delete data["_id"];
    let [updateStatus, doc] = await mongoUpdate({ id: id }, data);
    if (updateStatus) {
        return doc.value.id;
    }
    return false;
} 

async function mongoUpdate(query, data) {
    return new Promise((resolve , reject) => {
        mongodb.ImagingStudy.findOneAndUpdate(query, { $set: data } , {new:true  ,upsert: true , rawResult : true}, function (err, doc) {
            if (err) {
                console.error(err);
                return reject([false , err]);
            }
            return resolve([true, doc]);
        });
    });
}
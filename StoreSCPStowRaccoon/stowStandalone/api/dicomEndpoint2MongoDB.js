const mongodb = require("../models/mongodb");

async function isDocExist (id) {
    return new Promise (async (resolve , reject) => {
        mongodb["endpoint"].findOne ({id : id} , async function (err ,doc) {
            if (err) {
                return resolve (0); //error
            }
            if (doc) {
                return resolve(1); //have doc
            } else {
                return resolve(2); //no doc
            }
        });
    });
}
async function doUpdateData (data) {
    return new Promise((resolve , reject) => {
        let id = data.id;
        delete data._id;   
        mongodb["endpoint"].findOneAndUpdate({id : id }  ,{$set : data} , { new : true , rawResult: true} , function (err , newDoc) {
            if (err) {
                return resolve (["false" , err]);
            }
            return resolve(["true", {
                id: id,
                doc: newDoc.value.getFHIRField() , 
                code : 200
            }]);
        });
    });
}
async function doInsertData(data) {
    return new Promise ((resolve ) => {
        let updateData = new mongodb.endpoint(data);
        updateData.save(function (err, doc) {
            return resolve(err ? ["false",err] : ["true", {
                code : 201 , 
                doc: doc.getFHIRField()
            }]);
        });
    });
}
/**
 * 將DICOM endpoint儲存到 mongoDB
 */
module.exports.dicomEndpoint2MongoDB = async function(data) {
    return new Promise(async (resolve, reject) => {
        let dataExist = await isDocExist(data.id);
        let dataFuncAfterCheckExist = {
            0 : () => {
                return ["false" , ""];
            } ,
            1 : doUpdateData , 
            2 : doInsertData
        };
        let [ status , result] = await dataFuncAfterCheckExist[dataExist](data);
        return resolve([ status , result]);
    });
}
const mongodb = require("../models/mongodb");

function isDocExist (id) {
    return new Promise (async (resolve , reject) => {
        mongodb["patients"].findOne ({id : id} , async function (err ,doc) {
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
function doUpdateData (data) {
    return new Promise((resolve , reject) => {
        let id = data.id;
        mongodb["patients"].findOneAndUpdate({id : id }  ,{$set : data} , { new : true , rawResult: true} , function (err , newDoc) {
            delete data.id;
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
function doInsertData(data) {
    return new Promise ((resolve ) => {
        let updateData = new mongodb.patients(data);
        updateData.save(function (err, doc) {
            return resolve(err ? ["false",err] : ["true", {
                code : 201 , 
                doc: doc.getFHIRField()
            }]);
        });
    });
}

module.exports.dicomPatient2MongoDB = async function(data) {
    return new Promise(async (resolve) => {
        //let [updateStatus , doc]  = await updatePatient(req);
        let dataExist = await isDocExist(data.id);
        let dataFuncAfterCheckExist = {
            0 : () => {
                return ["false" , ""];
            } ,
            1 : doUpdateData , 
            2 : doInsertData
        };
        let [status , result] = await dataFuncAfterCheckExist[dataExist]();
        return resolve([status,result]);
    });
}


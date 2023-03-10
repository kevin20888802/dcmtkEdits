const {generateJpeg} = require("./generateJpeg");

const { dcm2EndpointFromImagingStudy } = require("../models/FHIR/DICOM2Endpoint");
const { dcm2jsonV8 } = require("../models/dcmtk");
const mongodb = require("../models/mongodb");
const { qidoRetAtt } = require("../models/FHIR/dicom-tag"); // eslint-disable-line @typescript-eslint/naming-convention
const _ = require("lodash");
const moment = require("moment");

async function isDocExist (id) {
    return new Promise (async (resolve , reject) => {
        mongodb["endpoint"].findOne ({id : id} , async function (err ,doc) {
            if (err) {
                errorMessage.message = err;
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
                errorMessage.message = err;
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
            errorMessage.message = err;
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
async function dicomEndpoint2MongoDB(data) {
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
function insertMetadata(metadata) {
    return new Promise(async (resolve) => {
        try {
            await mongodb.dicomMetadata.updateOne(
                {
                    $and: [
                        {
                            studyUID: metadata.studyUID
                        },
                        {
                            seriesUID: metadata.seriesUID
                        },
                        {
                            instanceUID: metadata.instanceUID
                        }
                    ]
                },
                metadata,
                {
                    upsert: true
                }
            );
            return resolve(true);
        } catch (e) {
            console.error(e);
            throw e;
        }
    });
}

/**
 * FHIR與DICOM合併
 */
module.exports.getFHIRIntegrateDICOMJson = async function (dicomJson, filename, fhirData) {
    try {
        let isNeedParsePatient = process.env.FHIR_NEED_PARSE_PATIENT == "true";
        let endPoint = dcm2EndpointFromImagingStudy(fhirData);
        await dicomEndpoint2MongoDB(endPoint);
        if (isNeedParsePatient) {
            await dicomPatient2MongoDB(dicomJson);
        }
        fhirData.endpoint = [
            {
                reference: `Endpoint/${endPoint.id}`,
                type: "Endpoint"
            }
        ];
        delete dicomJson["7fe00010"];
        let jpegFile = filename.replace(/\.dcm/gi, "");
        let sopClass = dcm2jsonV8.dcmString(dicomJson, "00080016");
        if (!notImageSOPClass.includes(sopClass)) {
            generateJpeg(dicomJson, filename, jpegFile);
        }

        let qidoLevelKeys = Object.keys(qidoRetAtt);
        let qidoAtt = _.cloneDeep(qidoRetAtt);
        for (let i = 0; i < qidoLevelKeys.length; i++) {
            let levelTags = Object.keys(qidoRetAtt[qidoLevelKeys[i]]);
            for (let x = 0; x < levelTags.length; x++) {
                let nowLevelKeyItem = qidoAtt[qidoLevelKeys[i]];
                let setValueTag = levelTags[x];
                if (dicomJson[setValueTag]) {
                    nowLevelKeyItem[setValueTag] = dicomJson[setValueTag];
                } else {
                    if (!_.isObject(nowLevelKeyItem[setValueTag])) {
                        delete nowLevelKeyItem[setValueTag];
                    }
                }
            }
        }

        let port = process.env.DICOMWEB_PORT || "";
        port = port ? `:${port}` : "";
        qidoAtt.study["00081190"] = {
            vr: "UT",
            Value: [
                `http://${process.env.DICOMWEB_HOST}${port}/${process.env.DICOMWEB_API}/studies/${qidoAtt.study["0020000D"].Value[0]}`
            ]
        };
        fhirData["dicomJson"] = qidoAtt.study;
        qidoAtt.series["00081190"] = {
            vr: "UT",
            Value: [
                `http://${process.env.DICOMWEB_HOST}${port}/${process.env.DICOMWEB_API}/studies/${qidoAtt.study["0020000D"].Value[0]}/series/${qidoAtt.series["0020000E"].Value[0]}`
            ]
        };
        fhirData.series[0].dicomJson = qidoAtt.series;
        qidoAtt.instance["00081190"] = {
            vr: "UT",
            Value: [
                `http://${process.env.DICOMWEB_HOST}${port}/${process.env.DICOMWEB_API}/studies/${qidoAtt.study["0020000D"].Value[0]}/series/${qidoAtt.series["0020000E"].Value[0]}/instances/${qidoAtt.instance["00080018"].Value[0]}`
            ]
        };
        fhirData.series[0].instance[0].dicomJson = qidoAtt.instance;
        dicomJson["7FE00010"] = {
            vr: "OW",
            BulkDataURI: `http://${process.env.DICOMWEB_HOST}${port}/${process.env.DICOMWEB_API}/studies/${qidoAtt.study["0020000D"].Value[0]}/series/${qidoAtt.series["0020000E"].Value[0]}/instances/${qidoAtt.instance["00080018"].Value[0]}`
        };

        //fhirData.series[0].instance[0].metadata = dicomJson;
        for (let i in fhirData.dicomJson["00080020"].Value) {
            fhirData.dicomJson["00080020"].Value[i] = moment(
                fhirData.dicomJson["00080020"].Value[i],
                "YYYYMMDD"
            ).toDate();
        }
        let metadata = _.cloneDeep(dicomJson);
        _.set(metadata, "studyUID", metadata["0020000D"].Value[0]);
        _.set(metadata, "seriesUID", metadata["0020000E"].Value[0]);
        _.set(metadata, "instanceUID", metadata["00080018"].Value[0]);
        await insertMetadata(metadata);
        return fhirData;
    } catch (e) {
        console.error(e);
        return false;
    }
}

/*** ### 非影像類SOP Class

1.2.840.10008.5.1.4.1.1.104.1 Encapsulated PDF Storage
1.2.840.10008.5.1.4.1.1.11.1 Grayscale Softcopy Presentation State Storage SOP Class
1.2.840.10008.5.1.4.1.1.11.2 Color Softcopy Presentation State Storage SOP Class
1.2.840.10008.5.1.4.1.1.11.3 Pseudocolor Softcopy Presentation Stage Storage SOP Class
1.2.840.10008.5.1.4.1.1.11.4 Blending Softcopy Presentation State Storage SOP Class

1.2.840.10008.5.1.4.1.1.481.2 Radiation Therapy Dose Storage
1.2.840.10008.5.1.4.1.1.481.3 Radiation Therapy Structure Set Storage
1.2.840.10008.5.1.4.1.1.481.4 Radiation Therapy Beams Treatment Record Storage
1.2.840.10008.5.1.4.1.1.481.5 Radiation Therapy Plan Storage
1.2.840.10008.5.1.4.1.1.481.6 Radiation Therapy Brachy Treatment Record Storage
1.2.840.10008.5.1.4.1.1.481.7 Radiation Therapy Treatment Summary Record Storage
1.2.840.10008.5.1.4.1.1.481.8 Radiation Therapy Ion Plan Storage
1.2.840.10008.5.1.4.1.1.481.9 Radiation Therapy Ion Beams Treatment Record Storage

1.2.840.10008.5.1.4.1.1.66 Raw Data Storage
1.2.840.10008.5.1.4.1.1.66.1 Spatial Registration Storage
1.2.840.10008.5.1.4.1.1.66.2 Spatial Fiducials Storage
1.2.840.10008.5.1.4.1.1.66.3 Deformable Spatial Registration Storage
1.2.840.10008.5.1.4.1.1.66.4 Segmentation Storage
1.2.840.10008.5.1.4.1.1.67 Real World Value Mapping Storage

1.2.840.10008.5.1.4.1.1.88.11 Basic Text SR
1.2.840.10008.5.1.4.1.1.88.22 Enhanced SR
1.2.840.10008.5.1.4.1.1.88.33 Comprehensive SR
1.2.840.10008.5.1.4.1.1.88.40 Procedure Log Storage
1.2.840.10008.5.1.4.1.1.88.50 Mammography CAD SR
1.2.840.10008.5.1.4.1.1.88.59 Key Object Selection Document
1.2.840.10008.5.1.4.1.1.88.65 Chest CAD SR
1.2.840.10008.5.1.4.1.1.88.67 X-Ray Radiation Dose SR

1.2.840.10008.5.1.4.1.1.9.1.1 12-lead ECG Waveform Storage
1.2.840.10008.5.1.4.1.1.9.1.2 General ECG Waveform Storage
1.2.840.10008.5.1.4.1.1.9.1.3 Ambulatory ECG Waveform Storage
1.2.840.10008.5.1.4.1.1.9.2.1 Hemodynamic Waveform Storage
1.2.840.10008.5.1.4.1.1.9.3.1 Cardiac Electrophysiology Waveform Storage
1.2.840.10008.5.1.4.1.1.9.4.1 Basic Voice Audio Waveform Storage
*/
const notImageSOPClass = [
   "1.2.840.10008.5.1.4.1.1.104.1",
   "1.2.840.10008.5.1.4.1.1.11.1",
   "1.2.840.10008.5.1.4.1.1.11.2",
   "1.2.840.10008.5.1.4.1.1.11.3",
   "1.2.840.10008.5.1.4.1.1.11.4",
   "1.2.840.10008.5.1.4.1.1.481.2",
   "1.2.840.10008.5.1.4.1.1.481.3",
   "1.2.840.10008.5.1.4.1.1.481.4",
   "1.2.840.10008.5.1.4.1.1.481.5",
   "1.2.840.10008.5.1.4.1.1.481.6",
   "1.2.840.10008.5.1.4.1.1.481.7",
   "1.2.840.10008.5.1.4.1.1.481.8",
   "1.2.840.10008.5.1.4.1.1.481.9",
   "1.2.840.10008.5.1.4.1.1.66",
   "1.2.840.10008.5.1.4.1.1.66.1",
   "1.2.840.10008.5.1.4.1.1.66.2",
   "1.2.840.10008.5.1.4.1.1.66.3",
   "1.2.840.10008.5.1.4.1.1.66.4",
   "1.2.840.10008.5.1.4.1.1.67",
   "1.2.840.10008.5.1.4.1.1.88.11",
   "1.2.840.10008.5.1.4.1.1.88.22",
   "1.2.840.10008.5.1.4.1.1.88.33",
   "1.2.840.10008.5.1.4.1.1.88.40",
   "1.2.840.10008.5.1.4.1.1.88.50",
   "1.2.840.10008.5.1.4.1.1.88.59",
   "1.2.840.10008.5.1.4.1.1.88.65",
   "1.2.840.10008.5.1.4.1.1.88.67",
   "1.2.840.10008.5.1.4.1.1.9.1.1",
   "1.2.840.10008.5.1.4.1.1.9.1.2",
   "1.2.840.10008.5.1.4.1.1.9.1.3",
   "1.2.840.10008.5.1.4.1.1.9.2.1",
   "1.2.840.10008.5.1.4.1.1.9.3.1",
   "1.2.840.10008.5.1.4.1.1.9.4.1",
   "1.2.840.10008.5.1.4.1.1.91.1"
];
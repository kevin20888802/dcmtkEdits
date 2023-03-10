const fs = require("fs");
const _ = require("lodash");

const mongodb = require("../models/mongodb");
const { dcmtkSupportTransferSyntax } = require("../models/dcmtk");

async function insertDicomToJpegTask(item) {
    return new Promise(async (resolve) => {
        try {
            await mongodb.dicomToJpegTask.updateOne(
                {
                    studyUID: item.studyUID,
                    seriesUID: item.seriesUID,
                    instanceUID: item.instanceUID
                },
                item,
                {
                    upsert: true
                }
            );
            resolve(true);
        } catch (e) {
            console.error(e);
            resolve(false);
        }
    });
}
module.exports.generateJpeg = async function (dicomJson, dicomFile, jpegFile) {
    let studyUID = _.get(dicomJson, "0020000D.Value.0");
    let seriesUID = _.get(dicomJson, "0020000E.Value.0");
    let instanceUID = _.get(dicomJson, "00080018.Value.0");
    try {
        await insertDicomToJpegTask({
            studyUID: studyUID,
            seriesUID: seriesUID,
            instanceUID: instanceUID,
            status: false,
            message: "processing",
            taskTime: new Date(),
            finishedTime: null,
            fileSize: (fs.statSync(dicomFile).size / 1024 / 1024).toFixed(3)
        });
        let windowCenter = _.get(dicomJson, "00281050.Value.0");
        let windowWidth = _.get(dicomJson, "00281051.Value.0");
        let frameNumber = _.get(dicomJson, "00280008.Value.0", 1);
        let transferSyntax = _.get(dicomJson, "00020010.Value.0");
        let execCmd = "";
        let execCmdList = [];
        if (dcmtkSupportTransferSyntax.includes(transferSyntax)) {
            for (let i = 1; i <= frameNumber; i++) {
                if (process.env.ENV == "windows") {
                    if (windowCenter && windowWidth) {
                        execCmd = `models/dcmtk/dcmtk-3.6.5-win64-dynamic/bin/dcmj2pnm.exe --write-jpeg "${dicomFile}" "${jpegFile}.${
                            i - 1
                        }.jpg" --frame ${i} +Ww ${windowCenter} ${windowWidth}`;
                    } else {
                        execCmd = `models/dcmtk/dcmtk-3.6.5-win64-dynamic/bin/dcmj2pnm.exe --write-jpeg "${dicomFile}" "${jpegFile}.${
                            i - 1
                        }.jpg" --frame ${i}`;
                    }
                } else if (process.env.ENV == "linux") {
                    if (windowCenter && windowWidth) {
                        execCmd = `dcmj2pnm --write-jpeg "${dicomFile}" "${jpegFile}.${
                            i - 1
                        }.jpg" --frame ${i} +Ww ${windowCenter} ${windowWidth}`;
                    } else {
                        execCmd = `dcmj2pnm --write-jpeg "${dicomFile}" "${jpegFile}.${
                            i - 1
                        }.jpg" --frame ${i}`;
                    }
                }
                execCmdList.push(execCmd);
                if (i % 4 === 0) {
                    await Promise.allSettled(
                        execCmdList.map((cmd) => dcm2jpegCustomCmd(cmd))
                    );
                    execCmdList = new Array();
                }
            }
        } else {
            for (let i = 1; i <= frameNumber; i++) {
                await getJpeg[process.env.ENV].getJpegByPydicom(dicomFile, i);
            }
        }
        await insertDicomToJpegTask({
            studyUID: studyUID,
            seriesUID: seriesUID,
            instanceUID: instanceUID,
            status: true,
            message: "generated",
            finishedTime: new Date()
        });
    } catch (e) {
        await insertDicomToJpegTask({
            studyUID: studyUID,
            seriesUID: seriesUID,
            instanceUID: instanceUID,
            status: false,
            message: e.toString(),
            finishedTime: new Date()
        });
        console.error(e);
        throw e;
    }
}
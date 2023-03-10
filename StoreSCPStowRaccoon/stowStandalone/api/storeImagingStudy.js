/**
 * 將ImagingStudy的資料存入資料庫。
 */
const mongodb = require("../models/mongodb");
const mongoFunc = require('../models/mongodb/func');
const _ = require("lodash");


module.exports.storeImagingStudy = async function(id , data) {
    let [insertStatus, doc] = await insertImagingStudy(data, id);
    return doc;
};

// 獲取特定Series的Study
async function getImagingStudySeries(series) {
    return new Promise(async (resolve) => {
        let series_query =
            [
                {
                    $match:
                    {
                        "series.uid": series.uid
                    }
                },
                {
                    $addFields:
                    {
                        "SeriesIndex":
                        {
                            $indexOfArray: ["$series.uid", series.uid]
                        }
                    }
                }
            ]
        await mongodb.ImagingStudy.aggregate([series_query], async function (err, oImagingStudy) {
            if (err) {
                return resolve(false);
            }
            return resolve(oImagingStudy);
        });
    });
}
// 獲取特定Series的Instance
async function getSeriesInstance(seriesUid, instance) {
    return new Promise(async (resolve) => {
        let query =
            [
                {
                    $match:
                    {
                        $and: [{ "series.uid": seriesUid }, { "series.instance.uid": instance.uid }]
                    }
                },
                {
                    $unwind: "$series"
                },
                {
                    $addFields:
                    {
                        "instanceIndex":
                        {
                            $indexOfArray: ["$series.instance.uid", instance.uid]
                        }
                    }
                }
            ]
        let agg = await mongoFunc.aggregate_Func('ImagingStudy', query);
        if (agg) {
            return resolve(agg);
        }
    });

}
// 檢查某個Instance是否存在於資料庫中
async function isInstanceExist(uid) {
    return new Promise(async (resolve, reject) => {
        let instance_query =
        {
            series:
            {
                $elemMatch:
                {
                    "instance.uid": uid
                }
            }
        }
        await mongodb.ImagingStudy.findOne(instance_query, async function (err, item) {
            if (err)
                return reject(new Error(err));
            if (item) {
                return resolve([true, item._id]);
            }
            else {
                return resolve(false);
            }
        }).clone();
    });
}

async function insertImagingStudy(insertData, id) {
    try {
        let hitImagingStudy = await mongodb.ImagingStudy.findOne({
            id: id
        });
        if (hitImagingStudy) {
            let imagingStudy = await new mongodb.ImagingStudy(hitImagingStudy);
            let tempInsertData = _.cloneDeep(insertData);
            delete tempInsertData.series;
            let dataKeys = Object.keys(tempInsertData);
            //update ImagingStudy exclude series
            for (let y = 0; y < dataKeys.length; y++) {
                imagingStudy[dataKeys[y]] = tempInsertData[dataKeys[y]];
            }
            for (let x in insertData.series) {
                let series = insertData.series[x];
                let seriesStudy = await getImagingStudySeries(series);
                if (seriesStudy[0]) {
                    for (let j in series.instance) {
                        let instance = series.instance[j];
                        let updateSeries = async function () {
                            return new Promise((resolve) => {
                                let tempSeries = JSON.parse(
                                    JSON.stringify(series)
                                );
                                delete tempSeries.instance;
                                let seriesKeys = Object.keys(tempSeries);
                                for (let i = 0; i < seriesKeys.length; i++) {
                                    imagingStudy.series[
                                        seriesStudy[0].SeriesIndex
                                    ]["_doc"][seriesKeys[i]] =
                                        tempSeries[seriesKeys[i]];
                                }
                                return resolve(true);
                            });
                        };
                        await updateSeries();
                        let isExist = await isInstanceExist(instance.uid);
                        if (isExist) {
                            //TODO 覆蓋原先資料
                            //let message =await errorHandler({message:"The instance is duplicate :" +insertData.series[x].instance[j].uid});
                            let instanceStudy = await getSeriesInstance(
                                series.uid,
                                instance
                            );
                            let instanceIndex = -1;
                            for (let data in instanceStudy) {
                                if (instanceStudy[data].instanceIndex != -1) {
                                    instanceIndex =
                                        instanceStudy[data].instanceIndex;
                                }
                            }
                            imagingStudy.series[
                                seriesStudy[0].SeriesIndex
                            ].instance[instanceIndex] = instance;
                            return [true, imagingStudy];
                        } else {
                            imagingStudy.series[
                                seriesStudy[0].SeriesIndex
                            ].instance.push(instance);
                            return [true, imagingStudy];
                        }
                    }
                } else {
                    // insert series
                    let imagingStudy = await new mongodb.ImagingStudy(
                        hitImagingStudy
                    );
                    imagingStudy.series.push(series);
                    return [true, imagingStudy];
                }
            }
        } else {
            console.log("no hit image study");
            //insert new ImagingStudy
            insertData.id = id.replace("urn:oid:", "");
            return [true, insertData];
        }
    } catch(e) {
        console.error(e);
        return [false, e];
    }
}
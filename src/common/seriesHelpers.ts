export function getSeries(asyncData: any, name: string, pred: (value: any) => boolean) {
    if (asyncData && asyncData.get(name)) {
        return asyncData.get(name).find(pred)
    }
    return null
}

export function getSeriesValue(asyncData: any, name: string, pred: (value: any) => boolean) {
    const val = getSeries(asyncData, name, pred)
    return val ? val[`Value #${name}`] : 0
}

export function getSeriesLabelValue(asyncData: any, name: string, labelName: string, pred: (value: any) => boolean) {
    const val = getSeries(asyncData, name, pred)
    return val ? val[labelName] : []
}

export function getAllSeries(asyncData: any, name: string, pred: (value: any) => boolean) {
    if (asyncData && asyncData.get(name)) {
        return asyncData.get(name).filter(pred)
    }
    return []
}

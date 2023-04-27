const compareMap = async (ppl, discog, progressCb) => {

    const progress = {
        total: ppl.length,
        done: 0,
    }
    const calculateScore = (pplRecord) => {
        if (!!!pplRecord?.recordingTitle){
            pplRecord.similarity = { score: 0, discogIndex: 0 };
            return pplRecord;
        }
        const pplTitle = (pplRecord.recordingTitle).toLowerCase();
        const pplTitleWords = pplTitle.split(' ');
        const pplTitlePartialWords = pplTitleWords.map((word) => {
            return word.slice(0, 3);
        });
        const pplTitlePartialWordsSet = new Set(pplTitlePartialWords);
        const pplTitleWordsSet = new Set(pplTitleWords);
        const pplTitleWordsLength = pplTitleWords.length;
        const pplTitlePartialWordsLength = pplTitlePartialWords.length;

        let maxScore = 0;
        let maxScoreIndex = 0;

        discog.forEach((discogRecord, i) => {
            const discogTitle = discogRecord.track_title.toLowerCase();
            const discogTitleWords = discogTitle.split(' ');
            const discogTitlePartialWords = discogTitleWords.map((word) => {
                return word.slice(0, 3);
            });
            const discogTitlePartialWordsSet = new Set(discogTitlePartialWords);
            const discogTitleWordsSet = new Set(discogTitleWords);
            const discogTitleWordsLength = discogTitleWords.length;
            const discogTitlePartialWordsLength = discogTitlePartialWords.length;

            const titleWordsMatch = pplTitleWordsSet.size + discogTitleWordsSet.size - new Set([...pplTitleWordsSet, ...discogTitleWordsSet]).size;
            const titlePartialWordsMatch = pplTitlePartialWordsSet.size + discogTitlePartialWordsSet.size - new Set([...pplTitlePartialWordsSet, ...discogTitlePartialWordsSet]).size;
            const score = (titleWordsMatch / (pplTitleWordsLength + discogTitleWordsLength)) + (titlePartialWordsMatch / (pplTitlePartialWordsLength + discogTitlePartialWordsLength));

            if (score > maxScore) {
                maxScore = score;
                maxScoreIndex = i;
            }
        });
        // setProgressCount(++progressCount);
        progress.done++;
        progressCb(progress);
        pplRecord.similarity = { score: maxScore, discogIndex: maxScoreIndex };
        return pplRecord;
    }

    const pplWithSimilarityPromises = ppl.map((record) => {
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve(calculateScore(record));
            }, 2);
        });
    });

    return Promise.all(pplWithSimilarityPromises).then((pplWithSimilarity) => {

        const filterScore = 1;
        const pplWithSimilarityFiltered = pplWithSimilarity.filter((pplRecord) => {
            return pplRecord.similarity.score >= filterScore;
        });

        // map similarity discogIndex to discog record
        const pplWithSimilarityDiscog = pplWithSimilarityFiltered.map((pplRecord) => {
            pplRecord.discog = discog[pplRecord.similarity.discogIndex];
            return pplRecord;
        });

        // flat discog record keys to ppl record keys and write to csv while keeping similaity score
        const _pplWithSimilarityDiscogFlat = pplWithSimilarityDiscog.map((pplRecord) => {
            const pplRecordFlat = { ...pplRecord };
            delete pplRecordFlat.discog;
            delete pplRecordFlat.similarity;
            const discogRecordFlat = { ...pplRecord.discog };
            return { ...pplRecordFlat, similarityScore: pplRecord.similarity.score, ...discogRecordFlat };
        });

        const pplWithSimilarityDiscogFlat = Array.from(new Set(_pplWithSimilarityDiscogFlat.map(t => t.recordingId))).map(recordId => _pplWithSimilarityDiscogFlat.find(t => t.recordingId === recordId))
        return pplWithSimilarityDiscogFlat;
    })
}

module.exports = {
    compareMap
}
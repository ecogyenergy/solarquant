import moment, {Moment} from "moment";

export interface MomentRange {
    beginInclusive: Moment,
    endExclusive: Moment,
}

export function getDateRanges(a: Moment, b: Moment): MomentRange[] {
    let ret = []

    for (let m = moment(a); m.diff(b, 'months') <= 0; m.add(1, 'months')) {
        let start;
        let end;

        if (m.isSame(a)) {
            start = a
            end = moment(m).add(1, 'months')
        } else if (m.isSame(b)) {
            break
        } else {
            start = m
            end = moment(m).add(1, 'months')
        }

        if (start && end) {
            ret.push({
                beginInclusive: moment(start),
                endExclusive: moment(end),
            })
        }
    }

    return ret
}
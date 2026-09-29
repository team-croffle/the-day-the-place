import { heritageSidoFromAddress } from '@nest-vue/shared';

import { parseHeritageList, toPlaceDesignations } from './heritage.mapper';

const xml = `<?xml version="1.0" encoding="utf-8"?>
<result>
<totalCnt>2</totalCnt>
<item>
<ccmaName><![CDATA[보물]]></ccmaName>
<ccbaMnm1><![CDATA[경복궁 자경전]]></ccbaMnm1>
<ccbaKdcd>12</ccbaKdcd>
<ccbaAsno>0008090000000</ccbaAsno>
<ccbaCtcd>11</ccbaCtcd>
<ccbaCncl>N</ccbaCncl>
</item>
<item>
<ccmaName><![CDATA[국보]]></ccmaName>
<ccbaMnm1><![CDATA[경복궁 근정전]]></ccbaMnm1>
<ccbaKdcd>11</ccbaKdcd>
<ccbaAsno>0002230000000</ccbaAsno>
<ccbaCtcd>11</ccbaCtcd>
<ccbaCncl>N</ccbaCncl>
</item>
<item>
<ccmaName><![CDATA[사적]]></ccmaName>
<ccbaMnm1><![CDATA[다른 궁]]></ccbaMnm1>
<ccbaKdcd>13</ccbaKdcd>
<ccbaAsno>0000010000000</ccbaAsno>
<ccbaCtcd>11</ccbaCtcd>
<ccbaCncl>N</ccbaCncl>
</item>
</result>`;

describe('parseHeritageList', () => {
  it('reads the total and item fields', () => {
    const parsed = parseHeritageList(xml);
    expect(parsed.total).toBe(2);
    expect(parsed.items[0]?.ccbaMnm1).toBe('경복궁 자경전');
  });

  it('rejects a body that is not the heritage result', () => {
    expect(() => parseHeritageList('<html></html>')).toThrow(/unexpected body/);
  });
});

describe('toPlaceDesignations', () => {
  it('keeps names that contain the place and sorts national treasures first', () => {
    const rows = toPlaceDesignations(parseHeritageList(xml).items, '경복궁');
    expect(rows.map((row) => row.name)).toEqual(['경복궁 근정전', '경복궁 자경전']);
    expect(rows[0]).toMatchObject({ kind: '국보', id: '11:0002230000000:11' });
  });
});

describe('heritageSidoFromAddress', () => {
  it('reads seoul and does not confuse chungbuk with chungnam', () => {
    expect(heritageSidoFromAddress('서울특별시 종로구')).toBe('11');
    expect(heritageSidoFromAddress('충청북도 청주시')).toBe('33');
    expect(heritageSidoFromAddress('경상남도 창원시')).toBe('38');
    expect(heritageSidoFromAddress('전북특별자치도 전주시')).toBe('35');
  });
});

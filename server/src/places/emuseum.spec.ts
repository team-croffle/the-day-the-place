import {
  compactPlaceName,
  detailFromXml,
  EmuseumError,
  museumCodeForName,
  relicsFromXml,
  toSummary,
  totalFromXml,
} from './emuseum';

const LIST_XML = `<?xml version="1.0"?>
<result><resultCode>0000</resultCode><list><data>
<item key="id" value="PS0100100100100000100000"/>
<item key="nameKr" value="삼혈포"/>
<item key="imgThumUriS" value="http://www.emuseum.go.kr/openapi/img?serviceKey=SECRET&amp;imageId=abc"/>
</data><data>
<item key="id" value="not-an-id"/>
<item key="nameKr" value="버린다"/>
</data></list></result>`;

describe('e-museum relics', () => {
  it('matches a museum only when the name is the same after removing spaces', () => {
    const museums = [
      { name: '국립중앙박물관', code: 'PS01001001' },
      { name: '국립제주박물관', code: 'PS01001011' },
    ];
    expect(museumCodeForName(museums, '국립 중앙 박물관')).toBe('PS01001001');
    expect(museumCodeForName(museums, '중앙박물관')).toBeNull();
    expect(compactPlaceName(' 국립\n중앙박물관 ')).toBe('국립중앙박물관');
  });

  it('keeps the relic name and drops the source image address from the public row', () => {
    const [relic] = relicsFromXml(LIST_XML);
    expect(relic?.name).toBe('삼혈포');
    expect(relicsFromXml(LIST_XML)).toHaveLength(1);
    expect(JSON.stringify(toSummary(relic!))).not.toContain('SECRET');
    expect(toSummary(relic!).hasImage).toBe(true);
  });

  it('uses the large thumbnail and the collection total', () => {
    const xml = `<?xml version="1.0"?>
<result><resultCode>0000</resultCode><totalCount>31521</totalCount><list><data>
<item key="id" value="PS0100100100100000100000"/>
<item key="nameKr" value="삼혈포"/>
<item key="imgThumUriS" value="http://www.emuseum.go.kr/openapi/img?serviceKey=SECRET&amp;imageId=small"/>
<item key="imgThumUriL" value="http://www.emuseum.go.kr/openapi/img?serviceKey=SECRET&amp;imageId=large"/>
</data></list></result>`;
    expect(relicsFromXml(xml)[0]?.imageUrl).toContain('imageId=large');
    expect(relicsFromXml(xml)[0]?.imageUrl).not.toContain('imageId=small');
    expect(totalFromXml(xml)).toBe(31521);
    expect(JSON.stringify(toSummary(relicsFromXml(xml)[0]!))).not.toContain('SECRET');
  });

  it('reads era and material from the detail document', () => {
    const detail = detailFromXml(`<result><resultCode>0000</resultCode><list><data>
<item key="id" value="PS0100100100100000100000"/>
<item key="nameKr" value="삼혈포"/>
<item key="nationalityName1" value="한국"/>
<item key="materialName2" value="철"/>
<item key="museumCode" value="PS01001001"/>
<item key="museumName2" value="국립중앙박물관"/>
</data></list></result>`);
    expect(detail).toMatchObject({ era: '한국', material: '철', museumCode: 'PS01001001' });
  });

  it('rejects an upstream result code', () => {
    expect(() => relicsFromXml('<result><resultCode>30</resultCode></result>')).toThrow(
      EmuseumError,
    );
  });
});

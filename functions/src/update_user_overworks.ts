const data = [
  {
    week: '2018-W35'
  },
  {
    week: '2018-W36'
  },
  {
    week: '2018-W37'
  },
  {
    week: '2018-W38'
  },
  {
    week: '2018-W39'
  },
  {
    week: '2018-W40'
  },
  {
    week: '2018-W41'
  },
  {
    week: '2018-W42'
  },
  {
    week: '2018-W43'
  },
  {
    week: '2018-W44'
  },
  {
    week: '2018-W45'
  },
  {
    week: '2018-W46'
  },
  {
    week: '2018-W47'
  },
  {
    week: '2018-W48'
  },
  {
    week: '2018-W49'
  },
  {
    week: '2018-W50'
  },
  {
    week: '2018-W51'
  },
  {
    week: '2018-W52'
  },
  {
    week: '2019-W01'
  },
  {
    week: '2019-W02'
  },
  {
    week: '2019-W03'
  },
  {
    week: '2019-W04'
  },
  {
    week: '2019-W06'
  },
  {
    week: '2019-W07'
  },
  {
    week: '2019-W08'
  },
  {
    week: '2019-W09'
  },
  {
    week: '2019-W11'
  },
  {
    week: '2019-W12'
  },
  {
    week: '2019-W13'
  },
  {
    week: '2019-W14'
  },
  {
    week: '2019-W15'
  },
  {
    week: '2019-W18'
  },
  {
    week: '2019-W20'
  },
  {
    week: '2019-W22'
  },
  {
    week: '2019-W23'
  }
];
const USER_ID = 'U07TZ9H44'; // 희진님
import axios from 'axios';

async function updateOverwors(userId: string, week: string) {
  const resp = await axios.post<{ week: string; user_id: string }>(
    'https://yanolja-cx-work-log-api.now.sh/over_work/sync',
    {
      week,
      user_id: userId
    }
  );
  console.log(resp.data);
}

async function go() {
  for (const value of data) {
    await updateOverwors(USER_ID, value.week);
  }
}

go();

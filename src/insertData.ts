import { InsertDataHelper } from './InsertDataHelper';

new InsertDataHelper().insertData()
    .catch((e) => console.log('Error caught', e))
    .finally(() => {
        console.log('Done.');
    });

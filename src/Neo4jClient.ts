import { Driver, Session } from 'neo4j-driver/types/v1';

export class Neo4jClient {
    constructor(
        private readonly driver: Driver,
        private readonly session: Session,
    ) {}

    public saveRepository(): Promise<any> {
        return new Promise((resolve, reject): void => {
            const personName = 'Alice';
            const resultPromise = this.session.run(
                'CREATE (a:Person {name: $name}) RETURN a',
                {name: personName}
            );

            resultPromise.then((result): any => {
                this.session.close();

                const singleRecord = result.records[0];
                const node = singleRecord.get(0);

                resolve(node);
            }).catch((error): any => {
                reject(error);
            });
        });
    }
}

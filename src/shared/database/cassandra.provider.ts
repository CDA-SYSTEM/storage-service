import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'cassandra-driver';
import { CASSANDRA_CLIENT_TOKEN } from '../../storage/constants/storage.constants';

export const cassandraProvider: Provider = {
  provide: CASSANDRA_CLIENT_TOKEN,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): Client => {
    const rawContactPoints =
      configService.get<string>('CASSANDRA_CONTACT_POINTS') ?? '127.0.0.1';
    const contactPoints = rawContactPoints
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const cassandraPort = configService.get<number>('CASSANDRA_PORT') ?? 9042;

    return new Client({
      contactPoints,
      protocolOptions: {
        port: cassandraPort,
      },
      localDataCenter:
        configService.get<string>('CASSANDRA_LOCAL_DATA_CENTER') ?? 'datacenter1',
      keyspace: configService.get<string>('CASSANDRA_KEYSPACE') ?? 'storage',
      credentials: {
        username: configService.get<string>('CASSANDRA_USERNAME') ?? 'cassandra',
        password: configService.get<string>('CASSANDRA_PASSWORD') ?? 'cassandra',
      },
    });
  },
};

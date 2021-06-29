const { ExpectedVersion } = require('@pg-journal/event-store')
const { benchmarkWrites, writeReportForWriteBenchmark } = require('./harness')
const { bootstrapEventStoreDb } = require('./bootstrap-eventstoredb')
const { bootstrapPgJournal } = require('./bootstrap-pg-journal')
const { jsonEvent, START, FORWARDS } = require('@eventstore/db-client')

const benchmarkName = require('path')
  .basename(__filename)
  .replace('.spec.js', '')

const eventsToWrite = 10000
const timeoutMs = 10000
const options = { eventsToWrite, concurrent: false, timeoutMs }

describe('a benchmark', () => {
  it('should benchmark pgjournal', async () => {
    const config = {
      image: 'library/postgres:10.12',
      poolSize: 4,
    }
    const pgJournal = await bootstrapPgJournal(config)

    console.log(`Starting benchmark for pg-journal`)
    const { appendTimes, startTime, eventsWritten } = await benchmarkWrites(
      () =>
        pgJournal.appendToStream({
          aggregateId: Math.random().toString(),
          events: [
            {
              type: 'Credited',
              payload: { amount: Math.random(), currency: 'CAD' },
            },
          ],
          expectedVersion: ExpectedVersion.NoStream,
        }),
      options
    )

    await pgJournal.close()
    await writeReportForWriteBenchmark({
      appendTimes,
      startTime,
      eventsWritten,
      benchmarkName,
      image: config.image,
      metadata: {
        ...config,
      },
    })
  }).timeout(60000)
  it('should benchmark eventstoredb', async () => {
    const config = {
      image: 'eventstore/eventstore:21.2.0-buster-slim',
      dockerFlags: [
        '-e',
        'EVENTSTORE_CLUSTER_SIZE=1',
        '-e',
        'EVENTSTORE_RUN_PROJECTIONS=none',
        '-e',
        'EVENTSTORE_START_STANDARD_PROJECTIONS=benchmarks',
        '-e',
        'EVENTSTORE_EXT_TCP_PORT=1113',
        '-e',
        'EVENTSTORE_EXT_HTTP_PORT=2113',
        '-e',
        'EVENTSTORE_INSECURE=1',
        '-e',
        'EVENTSTORE_ENABLE_EXTERNAL_TCP=true',
        '-e',
        'EVENTSTORE_ENABLE_ATOM_PUB_OVER_HTTP=true',
      ],
    }
    const eventStoreDb = await bootstrapEventStoreDb(config)

    console.log(`Starting benchmark for eventstoredb`)
    const { appendTimes, startTime, eventsWritten } = await benchmarkWrites(
      () =>
        eventStoreDb.appendToStream(Math.random().toString(), [
          jsonEvent({
            type: 'Credited',
            data: { amount: Math.random(), currency: 'CAD' },
          }),
        ]),
      options
    )

    await eventStoreDb.close()
    await writeReportForWriteBenchmark({
      appendTimes,
      startTime,
      eventsWritten,
      image: config.image,
      benchmarkName,
      metadata: {
        flags: config.dockerFlags.filter((val) => val !== '-e'),
      },
    })
  }).timeout(60000)
})
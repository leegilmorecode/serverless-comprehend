import AWS from 'aws-sdk';
import { APIGatewayProxyHandler, APIGatewayProxyResult, APIGatewayEvent } from 'aws-lambda';
import { v4 as uuid } from 'uuid';
import { schema } from './add-comment.schema';
import { validate } from '../../shared/validator';

const METHOD = 'add-comment.handler';
const LANGUAGE_CODE = 'en';

type DetectPiiEntitiesResponse = AWS.Comprehend.DetectPiiEntitiesResponse;
type DetectPiiEntitiesRequest = AWS.Comprehend.DetectPiiEntitiesRequest;
type DetectSentimentRequest = AWS.Comprehend.DetectSentimentRequest;
type DetectSentimentResponse = AWS.Comprehend.DetectSentimentResponse;
type ListOfPiiEntities = AWS.Comprehend.ListOfPiiEntities;
type PiiEntity = AWS.Comprehend.PiiEntity;

const comprehend = new AWS.Comprehend({ apiVersion: '2017-11-27' });

const redactPiiFromText = (pii: ListOfPiiEntities = [], text = ''): string => {
  return pii.reduce(
    (previous, current) =>
      `${previous}`.replace(
        new RegExp(`${previous.substring(current.EndOffset || 0, current.BeginOffset || 0)}`, 'i'),
        '*'.repeat((current.EndOffset || 0) - (current.BeginOffset || 0)),
      ),
    text,
  );
};

const detectPiiEntities = async (text = '', languageCode = LANGUAGE_CODE): Promise<DetectPiiEntitiesResponse> => {
  const detectPiiEntitiesRequest: DetectPiiEntitiesRequest = {
    Text: text,
    LanguageCode: languageCode,
  };

  return comprehend.detectPiiEntities(detectPiiEntitiesRequest).promise();
};

const detectSentiment = async (text = '', languageCode = LANGUAGE_CODE): Promise<DetectSentimentResponse> => {
  const detectSentimentRequest: DetectSentimentRequest = {
    Text: text,
    LanguageCode: languageCode,
  };

  return comprehend.detectSentiment(detectSentimentRequest).promise();
};

export const handler: APIGatewayProxyHandler = async ({ body }: APIGatewayEvent): Promise<APIGatewayProxyResult> => {
  try {
    const correlationId = uuid();

    if (!body) {
      throw new Error('no body on request');
    }

    const parsedBody = JSON.parse(body);

    // validate the payload i.e. the comment
    validate(parsedBody, schema);

    const { comment }: { comment: string } = parsedBody;

    // you would never log the output but we want to view the logs to see how this has worked in fine detail
    console.log(`${correlationId} - ${METHOD} - started with comment: ${JSON.stringify(comment)}`);

    // detect the sentiment of the comment and log it to cloud watch
    const { Sentiment: sentiment, SentimentScore: sentimentScore }: DetectSentimentResponse = await detectSentiment(
      comment,
      LANGUAGE_CODE,
    );

    console.log(
      `${correlationId} - ${METHOD} - sentiment of comment: ${sentiment}, score: ${JSON.stringify(sentimentScore)}`,
    );

    // detect the PII entities within the comment
    const { Entities: pii = [] }: DetectPiiEntitiesResponse = await detectPiiEntities(comment, LANGUAGE_CODE);

    console.log(`${correlationId} - ${METHOD} - PII ${pii.length ? 'is' : 'not'} found`);

    // for each piece of pii found, log its label name and score so we can view it in cloud watch (again you would not do this for GDPR)
    pii.forEach((item: PiiEntity): void =>
      console.log(
        `${correlationId} - ${METHOD} - name: ${item.Type} score: ${item.Score} beginOffset: ${item.BeginOffset} endOffset: ${item.EndOffset}`,
      ),
    );

    // replace any of the pii which was found by comprehend with *'s
    // you can also do this async with batch jobs using StartPiiEntitiesDetectionJob which will mask the pii for you
    const redactedComment: string = redactPiiFromText(pii, comment);

    console.log(`${correlationId} - ${METHOD} - redacted comment: ${redactedComment}`);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        {
          sentiment,
          sentimentScore,
          comment,
          redactedComment,
        },
        null,
        2,
      ),
    };
  } catch (error: any) {
    console.error(`${METHOD} - error: ${JSON.stringify(error)}`);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(error.message, null, 2),
    };
  }
};

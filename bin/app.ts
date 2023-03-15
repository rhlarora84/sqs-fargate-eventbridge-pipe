#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {AppStack} from '../lib/app-stack';


const app = new cdk.App();
new AppStack(app, 'sqs-fargate-eventbridge-pipe', {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION,
    }
});
app.synth()
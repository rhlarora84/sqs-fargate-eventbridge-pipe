# sqs-fargate-eventbridge-pipe
Example for invoking Fargate Task from SQS using Eventbridge Pipes.     

![](image.png)

At a high level, the code will create the following AWS Resources
- SQS Queue
- Dead Letter Queue for SQS
- ECS Cluster with Fargate Capacity Provider
- Task Definition
- IAM Role for Eventbridge Pipe
- Eventbridge Pipe

### Testing the setup
- Deploy the CDK Stack
- Publish a Message with JSON Payload on SQS Queue
```json
{
  "SQS_PAYLOAD": "Hello World"
}
```
- ECS Task will be created and task will output the SQS Payload passed in the body
- Finally Destroy the stack 


### Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

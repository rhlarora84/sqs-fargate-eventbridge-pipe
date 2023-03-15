import {App} from "aws-cdk-lib";
import {AppStack} from "../lib/app-stack";
import {Template} from "aws-cdk-lib/assertions";

test('SQS Queue Created', () => {
    const app = new App();
    // WHEN
    const stack = new AppStack(app, 'MyTestStack');
    // THEN
    const template = Template.fromStack(stack);

    template.hasResourceProperties('AWS::SQS::Queue', {
        VisibilityTimeout: 300
    });
});

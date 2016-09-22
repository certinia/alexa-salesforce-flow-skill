/**
 * Copyright (c), FinancialForce.com, inc
 * All rights reserved.
 * 
 * Redistribution and use in source and binary forms, with or without modification, 
 *    are permitted provided that the following conditions are met:
 * 
 * - Redistributions of source code must retain the above copyright notice, 
 *     this list of conditions and the following disclaimer.
 * - Redistributions in binary form must reproduce the above copyright notice, 
 *     this list of conditions and the following disclaimer in the documentation 
 *     and/or other materials provided with the distribution.
 * - Neither the name of the FinancialForce.com, inc nor the names of its contributors 
 *     may be used to endorse or promote products derived from this software without 
 *     specific prior written permission.
 * 
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND 
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES 
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL 
 * THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, 
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
 * OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
 * OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
**/

/**
 * Login to your Salesforce org
 */
var USER_NAME = "";
var PASSWORD = "";

/**
 * App ID for the skill
 */
var APP_ID = undefined; //replace with "amzn1.echo-sdk-ams.app.[your-unique-value-here]";

/**
 * The AlexaSkill prototype and helper functions
 */
var AlexaSkill = require('./AlexaSkill');
var nforce = require('nforce');

/**
 * SalesforceFlowSkill is a child of AlexaSkill.
 * To read more about inheritance in JavaScript, see the link below.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Introduction_to_Object-Oriented_JavaScript#Inheritance
 */
var SalesforceFlowSkill = function () {
    AlexaSkill.call(this, APP_ID);
};

// Extend SalesforceFlowSkill
SalesforceFlowSkill.prototype = Object.create(AlexaSkill.prototype);
SalesforceFlowSkill.prototype.constructor = SalesforceFlowSkill;

SalesforceFlowSkill.prototype.eventHandlers.onSessionStarted = function (sessionStartedRequest, session) {
    console.log("SalesforceFlowSkill onSessionStarted requestId: " + sessionStartedRequest.requestId + ", sessionId: " + session.sessionId);
};

SalesforceFlowSkill.prototype.eventHandlers.onLaunch = function (launchRequest, session, response) {
    console.log("SalesforceFlowSkill onLaunch requestId: " + launchRequest.requestId + ", sessionId: " + session.sessionId);
    response.tell("I will run Salesforce Flows!");
};

SalesforceFlowSkill.prototype.eventHandlers.onSessionEnded = function (sessionEndedRequest, session) {
    console.log("SalesforceFlowSkill onSessionEnded requestId: " + sessionEndedRequest.requestId + ", sessionId: " + session.sessionId);
};

SalesforceFlowSkill.prototype.eventHandlers.onIntent = function (intentRequest, session, response) {

    // Extract intent name
    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;
    console.log("SalesforceFlowSkill onIntent requestId: " + intentRequest.requestId + ", sessionId: " + session.sessionId + ", intentName: " + intentName);

    // Configure a connection (Salesforce Connected App, does not need setting up over and over)
    var org = nforce.createConnection({
        clientId: '3MVG98_Psg5cppyZIHvLuw.KzXEUWizB2YLAEnYXKoYNiu0.MpeWU0Tplsm7o8SVkK3p51iru8YEs2PUJya8f',
        clientSecret: '2899208852999383752',
        redirectUri: 'http://localhost:3000/oauth/_callback',
        mode: 'single'
    });

    // Call a Flow!
    // TODO: Support sessions scope for Salesforce login, better still the linked account thing!
    org.authenticate({ username: USER_NAME, password: PASSWORD}).
        then(function() {

            // Build Flow input parameters
            var params = {};
            // From Session...
            for(var sessionAttr in session.attributes) {
                params[sessionAttr] = session.attributes[sessionAttr];
            }
            // From Slots...
            for(var slot in intent.slots) {
                if(intent.slots[slot].value != null) {
                    if(slot.endsWith('Number')) {
                        params["Alexa_Slot_" + slot] = Number(intent.slots[slot].value);
                    } else {
                        params["Alexa_Slot_" + slot] = intent.slots[slot].value;
                    }
                }
            }

            // Call the Flow API
            var opts = org._getOpts(null, null);
            opts.resource = '/actions/custom/flow/'+intentName;
            opts.method = 'POST';
            var flowRunBody = {};
            flowRunBody.inputs  = [];
            flowRunBody.inputs[0] = params;
            opts.body = JSON.stringify(flowRunBody);
            console.log("SalesforceFlowSkill onIntent Flow Params: " + opts.body);
            org._apiRequest(opts).
            then(function(resp){
                // Ask or Tell?
                var ask = resp[0].outputValues['Alexa_Ask'];
                var tell = resp[0].outputValues['Alexa_Tell'];
                if(tell!=null) {
                    // Tell the user something (closes the session)
                    response.tell(tell);
                    console.log(tell);
                } else if (ask!=null) {
                    // Store Alexa_Session prefixed output variables in Session
                    for(var outputVarName in resp[0].outputValues) {
                        if(outputVarName == "Alexa_Ask")
                            continue;
                        if(outputVarName == "Alexa_Tell")
                            continue;
                        if(outputVarName == "Flow__InterviewStatus")
                            continue;
                        session.attributes[outputVarName] = resp[0].outputValues[outputVarName];
                    }
                    // Ask another question (keeps session open)
                    response.ask(ask, ask);
                    console.log(ask);
                }
            }).
            error(function(err){
                console.log(err.body[0].errors[0].message);
                response.tell("Error running Flow " + err.body[0].errors[0].message);
            });

        }).error(function(err){
            console.log(err.message);
            response.tell("Error running Flow " + err.message);
        });

};

// Create the handler that responds to the Alexa Request.
exports.handler = function (event, context) {
    // Create an instance of the SalesforceFlowSkill skill.
    var salesforceFlowSkill = new SalesforceFlowSkill();
    salesforceFlowSkill.execute(event, context);
};
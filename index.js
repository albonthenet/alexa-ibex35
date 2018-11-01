/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require('ask-sdk-core');

/**********************************
************ CONSTS ***************
***********************************/
//General constants
const APP_ID = "amzn1.ask.skill.284a9f0d-e850-4698-ac67-fb6c86abd8a2";
const SKILL_NAME = 'IBEX 35 info';
const WELCOME_MESSAGE = 'Bienvenido a IBEX 35 info. ¿Quieres conocer la cotización o variación de algún valor?';
const REPROMPT_MESSAGE = '¿Quieres información sobre otro valor?';
const GET_FACT_MESSAGE = 'La cotización actual es: ';
const HELP_MESSAGE = 'Puedes pedirme la cotización, variación o variación por meses de un valor o decir salir. ¿Que quieres hacer?';
const HELP_REPROMPT = 'Como puedo ayudarte?';
const STOP_MESSAGE = 'Suerte con tus inversiones, ¡adios!';
//const ERROR_MESSAGE = 'Se ha producido un error'

//Additional skill consts
const ERROR_MESSAGE = 'Lo siento, no te he entendido o no tengo información sobre ese valor';
const ERROR_MESSAGE_REPROMPT = 'Lo siento, no te he entendido, ' + HELP_MESSAGE;
const NOT_STOCK_FOUND_MESSAGE = 'Lo siento, no tengo información sobre ese valor. ¿Quieres información sobre otro valor del IBEX 35?';
const NOT_STOCK_FOUND_MESSAGE_REPROMPT = 'No entendí tu última petición, ¿Quieres información sobre otro valor del IBEX 35?';

//Vars import
var KEY_POOL = require('./vars.js');

/**********************************
********* FUNCTIONS ***************
***********************************/
//Example of query (MSFT ticker example)
//// https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=MSFT&apikey=demo
//// https://www.alphavantage.co/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=MSFT&apikey=demo
//// httpGet args:
// requestType: 0 = GLOBAL_QUOTE, 1 = TIME_SERIES_MONTHLY_ADJUSTED
function httpGet(requestType,TickerCode) {
  return new Promise(((resolve, reject) => {
    var http = require('https');
    const key = get_key();
    
    if (requestType == 0)
    {
      var options = {
          host: 'www.alphavantage.co',
          path: '/query?function=GLOBAL_QUOTE&symbol=' + encodeURIComponent(TickerCode) + '&apikey='+ key,
          method: 'GET'
      };
    }else if (requestType == 1){
      var options = {
          host: 'www.alphavantage.co',
          path: '/query?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=' + encodeURIComponent(TickerCode) + '&apikey='+ key,
          method: 'GET'
      };
    }
    console.log("key in use: "+ key );
    const request = http.request(options, (response) => {
      response.setEncoding('utf8');
      let returnData = '';

      if (response.statusCode < 200 || response.statusCode >= 300) {
        return reject(new Error(`${response.statusCode}: ${response.req.getHeader('host')} ${response.req.path}`));
      }

      response.on('data', (chunk) => {
        returnData += chunk;
      });
      
      response.on('end', () => {
        resolve(JSON.parse(returnData));
      });
      
      response.on('error', (error) => {
        reject(error);
      });
    });
    
    request.on('error', function (error) {
      reject(error);
    });
    
    request.end();
  }));
}

//Provides % variation between current price and N month price in the past
function getVariation(data,pastMonthNumber){
  var monthlyAll = data["Monthly Adjusted Time Series"];
  var month0 = monthlyAll.getByIndex(0); //current month as per API received
  var monthN = monthlyAll.getByIndex(pastMonthNumber);
  
  var valueAtCloseMonth0 = month0["4. close"];
  var valueAtCloseMonth1 = monthN["4. close"];
  
  //Here we do verify that we got data. for example if the stock does not have
  //info for the last year, we will get 'undefined' therefore alexa will answer
  //informaing of this lack of data
  if (valueAtCloseMonth0 == 'undefined' || valueAtCloseMonth1 == 'undefined'){
    return 'no_data_available';
  }else{
    return varPercentage(valueAtCloseMonth1,valueAtCloseMonth0);
  }
 
}

//First param: number, Second param: round to 'places' decimals
function roundNumber(numStr, places) {
  var num = parseFloat(numStr).toFixed(places);
  console.log("Rounded-2 value number : "+num);
  return num.toString();
}

//get random key from pool
function get_key(){
  return KEY_POOL[Math.floor(Math.random()*KEY_POOL.length)];
}

//Helper for monthly reports JSON parsing
Object.prototype.getByIndex = function(index) {
  return this[Object.keys(this)[index]];
};

function varPercentage(n1, n2){
	var res = (((n2 * 100) / n1)-100);
	return roundNumber(res, 2);
}

/**********************************
********* HANDLERS ****************
***********************************/

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'LaunchRequest';
  },
  handle(handlerInput) {
      console.log("welcome message");
      return handlerInput.responseBuilder
      .speak(WELCOME_MESSAGE)
      .withSimpleCard(SKILL_NAME, "Bienvenido a IBEX 35 info")
      .reprompt(HELP_MESSAGE)
      .getResponse();
  },
};

const GetStockCurrentPriceVariationHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'IntentRequest' && (
      request.intent.name === 'GetStockPrice') 
      || request.intent.name === 'GetStockVariationPercent')
     ;
  },
  handle(handlerInput) {
    var speechOutput;
    var stockPrice;
    var stockVariationPercentage;
    const stockID = handlerInput.requestEnvelope.request.intent.slots.StockName.resolutions.resolutionsPerAuthority[0].values[0].value.id;
    const stockName =  handlerInput.requestEnvelope.request.intent.slots.StockName.resolutions.resolutionsPerAuthority[0].values[0].value.name;

    return new Promise((resolve, reject) => {
    httpGet(0,stockID).then((response) => {
      const queryResult = response; //This is already an JSON parsed object parsed in httpGet func.
      if (handlerInput.requestEnvelope.request.intent.name == 'GetStockPrice')
      {
        stockPrice = roundNumber(queryResult["Global Quote"]["05. price"],2); 
        console.log("la accion vale " + stockPrice); 
        speechOutput = "La cotización actual es de " + stockPrice + " euros, ¿Quieres información sobre otro valor?";
        console.log(speechOutput); 
        
        resolve(handlerInput.responseBuilder
        .speak(speechOutput)
        .withSimpleCard(SKILL_NAME, "La cotización actual de " + stockName + " es de " + stockPrice + " euros")
        .reprompt(REPROMPT_MESSAGE)
        .getResponse());
      }
      if(handlerInput.requestEnvelope.request.intent.name == 'GetStockVariationPercent')
      {
        stockVariationPercentage = roundNumber(queryResult["Global Quote"]["10. change percent"],2); 
        console.log("la accion varia " + stockVariationPercentage); 
        speechOutput = "La variación respecto apertura es del " + stockVariationPercentage + "%, ¿Quieres información sobre otro valor?";
        console.log(speechOutput); 
        
        resolve(handlerInput.responseBuilder
        .speak(speechOutput)
        .withSimpleCard(SKILL_NAME, "La variación respecto apertura de " + stockName + " es " + stockVariationPercentage + "%")
        .reprompt(REPROMPT_MESSAGE)
        .getResponse());
      }
    }).catch((error) => {
      resolve(handlerInput.responseBuilder
      .speak(ERROR_MESSAGE)
      .getResponse());
    });
    });
  },
};

const GetStockVariationInTimeHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return (request.type === 'IntentRequest' && (
      request.intent.name === 'GetStockVariationPercentMonths'))
     ;
  },
  handle(handlerInput) {
    var speechOutput;
    var stockVariationPercentage;
    const stockID = handlerInput.requestEnvelope.request.intent.slots.StockName.resolutions.resolutionsPerAuthority[0].values[0].value.id;
    const stockName =  handlerInput.requestEnvelope.request.intent.slots.StockName.resolutions.resolutionsPerAuthority[0].values[0].value.name;
    
    const timeperiodID = handlerInput.requestEnvelope.request.intent.slots.VariationPeriod.resolutions.resolutionsPerAuthority[0].values[0].value.id;
    //const timeperiodName =  handlerInput.requestEnvelope.request.intent.slots.VariationPeriod.resolutions.resolutionsPerAuthority[0].values[0].value.name;

    return new Promise((resolve, reject) => {
    httpGet(1,stockID).then((response) => {
       
      const queryResult = response; //This is already an JSON parsed object parsed in httpGet func.
      if (timeperiodID == 'VARI_ONEMONTH'){

	      stockVariationPercentage = getVariation(queryResult,1);
	      
	      if (stockVariationPercentage != 'no_data_available'){
          //stockPrice = roundNumber(queryResult["Global Quote"]["05. price"],2); 
          speechOutput = "La variación en el último mes de " + stockName + " es del " + stockVariationPercentage +"%. ¿Quieres información sobre otro valor?";
          console.log(speechOutput); 
          
          resolve(handlerInput.responseBuilder
          .speak(speechOutput)
          .withSimpleCard(SKILL_NAME, "La variación en el último mes de " + stockName + " es del " + stockVariationPercentage + "%")
          .reprompt(REPROMPT_MESSAGE)
          .getResponse());
	      }
	      else{
          resolve(handlerInput.responseBuilder
          .speak(ERROR_MESSAGE)
          .getResponse());
	      }

     }
     else if (timeperiodID == 'VARI_THREEMONTH'){
   
	      stockVariationPercentage = getVariation(queryResult,3);
        //stockPrice = roundNumber(queryResult["Global Quote"]["05. price"],2); 
        speechOutput = "La variación en el último trimestre de " + stockName + " es del " + stockVariationPercentage +"%. ¿Quieres información sobre otro valor?";
        console.log(speechOutput); 
        
        resolve(handlerInput.responseBuilder
        .speak(speechOutput)
        .withSimpleCard(SKILL_NAME, "La variación en el último trimestre de " + stockName + " es del " + stockVariationPercentage + "%")
        .reprompt(REPROMPT_MESSAGE)
        .getResponse());
       
     }
     else if (timeperiodID == 'VARI_SIXMONTH'){
       
	      stockVariationPercentage = getVariation(queryResult,6);
        //stockPrice = roundNumber(queryResult["Global Quote"]["05. price"],2); 
        speechOutput = "La variación en el último semestre de " + stockName + " es del " + stockVariationPercentage +"%. ¿Quieres información sobre otro valor?";
        console.log(speechOutput); 
        
        resolve(handlerInput.responseBuilder
        .speak(speechOutput)
        .withSimpleCard(SKILL_NAME, "La variación en el último semestre de " + stockName + " es del " + stockVariationPercentage + "%")
        .reprompt(REPROMPT_MESSAGE)
        .getResponse());
       
     }
     else if (timeperiodID == 'VARI_YEAR'){
       
	      stockVariationPercentage = getVariation(queryResult,12);
        //stockPrice = roundNumber(queryResult["Global Quote"]["05. price"],2); 
        speechOutput = "La variación en el último año de " + stockName + " es del " + stockVariationPercentage +"%. ¿Quieres información sobre otro valor?";
        console.log(speechOutput); 
        
        resolve(handlerInput.responseBuilder
        .speak(speechOutput)
        .withSimpleCard(SKILL_NAME, "La variación en el último año de " + stockName + " es del " + stockVariationPercentage + "%")
        .reprompt(REPROMPT_MESSAGE)
        .getResponse());
     }
     else{
        //Shouldn't get here
        resolve(handlerInput.responseBuilder
        .speak(ERROR_MESSAGE)
        .getResponse());
     }
     }).catch((error) => {
        resolve(handlerInput.responseBuilder
        .speak(ERROR_MESSAGE)
        .getResponse());
      });
    });
  },
};

const HelpHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && request.intent.name === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(HELP_MESSAGE)
      .reprompt(HELP_REPROMPT)
      .getResponse();
  },
};

const ExitHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'IntentRequest'
      && (request.intent.name === 'AMAZON.CancelIntent'
        || request.intent.name === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(STOP_MESSAGE)
      .getResponse();
  },
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    const request = handlerInput.requestEnvelope.request;
    return request.type === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);

    return handlerInput.responseBuilder.getResponse();
  },
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);
    /*
    This gives an error if the requested attribute does not exists, 
    therefore it is better just to use the ELSE part which catches any errors
    if (handlerInput.requestEnvelope.request.intent.slots.StockName.resolutions.resolutionsPerAuthority[0].status.code == 'ER_SUCCESS_NO_MATCH' ){
      return handlerInput.responseBuilder
        .speak(NOT_STOCK_FOUND_MESSAGE)
        .reprompt(NOT_STOCK_FOUND_MESSAGE_REPROMPT)
        .getResponse();
    }
    else{
      return handlerInput.responseBuilder
        .speak(ERROR_MESSAGE)
        .reprompt(ERROR_MESSAGE)
        .getResponse();
    }
    TBD: check:
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    
    */
    return handlerInput.responseBuilder
      .speak(ERROR_MESSAGE)
      .reprompt(ERROR_MESSAGE_REPROMPT)
      .getResponse();
  },
};

const skillBuilder = Alexa.SkillBuilders.custom();

exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequestHandler,
    GetStockCurrentPriceVariationHandler,
    GetStockVariationInTimeHandler,
    HelpHandler,
    ExitHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
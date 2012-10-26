int RFIDResetPin = 13;

//Register your RFID tags here
char tag1[13] = "1E009A4067A3";
char tag2[13] = "010230F28243";
char tag3[13] = "01023C013A04";
char tag4[13] = "01023101093A";
char tag5[13] = "01023C0A4376";
char tag6[13] = "01023C000E31";
char tag7[13] = "01023C0A3207";
char tag8[13] = "1A004116317C";
char tag9[13] = "1E009A81F9FC";
char tag10[13] = "1A004162261F";

void setup(){
  Serial.begin(9600);
  Serial.println("ENGAGE");

  pinMode(RFIDResetPin, OUTPUT);
  digitalWrite(RFIDResetPin, HIGH);

  //ONLY NEEDED IF CONTROLING THESE PINS - EG. LEDs
}

boolean reading = false;

void loop(){

  char tagString[13];
  int index = 0;
  
  if (Serial.available()) {
  }

  while(Serial.available()){

    int readByte = Serial.read(); //read next available byte

    if(readByte == 2) {
      Serial.println("---------------------------");
      reading = true; //begining of tag
    }
    if(readByte == 3) reading = false; //end of tag

    if (reading && readByte != 2 && readByte != 10 && readByte != 13){
      Serial.println(readByte, HEX);
      //store the tag
      tagString[index] = readByte;
      index ++;
    }
  }

  //checkTag(tagString); //Check if it is a match
  //clearTag(tagString); //Clear the char of all value
  //resetReader(); //eset the RFID reader
}

void lightLED(int pin){
///////////////////////////////////
//Turn on LED on pin "pin" for 250ms
///////////////////////////////////
  Serial.println(pin);

  digitalWrite(pin, HIGH);
  delay(250);
  digitalWrite(pin, LOW);
}

void resetReader(){
///////////////////////////////////
//Reset the RFID reader to read again.
///////////////////////////////////
  digitalWrite(RFIDResetPin, LOW);
  digitalWrite(RFIDResetPin, HIGH);
  delay(150);
}

void clearTag(char one[]){
///////////////////////////////////
//clear the char array by filling with null - ASCII 0
//Will think same tag has been read otherwise
///////////////////////////////////
  for(int i = 0; i < strlen(one); i++){
    one[i] = 0;
  }
}

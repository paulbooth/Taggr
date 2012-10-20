 
#include <SoftwareSerial.h>

SoftwareSerial impSerial(8, 9); // RX on 8, TX on 9

void setup()  
{
 // Open the hardware serial port
  Serial.begin(19200);
  Serial.flush();
  // set the data rate for the SoftwareSerial port
  impSerial.begin(19200);
}

void loop() // run over and over
{  
  // Send data from the software serial
  if (impSerial.available())
    Serial.write(impSerial.read());  // to the hardware serial
  // Send data from the hardware serial
  
  int i=0;
  char commandbuffer[100];

  if(Serial.available()){
     delay(100);
     while( Serial.available() && i< 99) {
        commandbuffer[i++] = Serial.read();
     }
     commandbuffer[i++]='\0';
  }

  if(i>0) {
     Serial.println((char*)commandbuffer);
     impSerial.write((char*)commandbuffer);
  }
     
//  if (Serial.available())
//    impSerial.write(Serial.read());  // to the software serial
}



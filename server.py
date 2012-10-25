import serial
arduino = serial.Serial('/dev/tty.usbmodem1421', 9600)

while 1:
  data = arduino.readline()
  print data
  # if data == "print more":
  #   i = 0
  #   byte = f.read(1)
  #   while byte != "" and i < 32: #limit it to 32 bytes for now
  #     #print "sending to arduino"
  #     i = i + 1
  #     byte = f.read(1)
  #     print(byte)
  #     #send it over serial
  #     arduino.write(byte)
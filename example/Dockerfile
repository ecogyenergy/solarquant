FROM thomaspassmore/solarquant:latest

RUN apt-get install python3 curl
RUN curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
RUN python3 get-pip.py
RUN pip install pandas numpy lightgbm matplotlib seaborn


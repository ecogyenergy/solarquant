Location Data
=============

Introduction
------------

Location data is available to SolarQuant like most data provided by SolarNetwork. This section of the documentation
assumes that you're familiar with the general process of using SolarQuant, and instead focuses on the specific process
of exporting location data.

Tutorial: Exporting Location Data
---------------------------------

Investigating Location Sources
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

First, obtain a list of sources that we can export from our location:

.. code-block:: console

    $ sqc projects location 11537068
    ┌──────────┬─────────────────────────┬──────────────────┬────────────┐
    │ location │ sourceId                │ tags             │ name       │
    ├──────────┼─────────────────────────┼──────────────────┼────────────┤
    │ 11537068 │ OpenWeatherMap          │ weather          │ Wilmington │
    │ 11537068 │ OpenWeatherMap Day      │ day              │ Wilmington │
    │ 11537068 │ OpenWeatherMap Forecast │ weather,forecast │ Wilmington │
    └──────────┴─────────────────────────┴──────────────────┴────────────┘


Investigating Source Measurements
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

To export data from one of these sources, it's useful to know what measurements we have available to us:

.. code-block:: console

    $ sqc projects location 11537068 -s 'OpenWeathermap Forecast'
    ┌──────────┬────────────────────────┬─────────────┬────────┐
    │ location │ sourceId               │ measurement │ type   │
    ├──────────┼────────────────────────┼─────────────┼────────┤
    │ 11537068 │ OpenWeatherMap Forcast │ atm         │ number │
    │ 11537068 │ OpenWeatherMap Forcast │ temp        │ number │
    │ 11537068 │ OpenWeatherMap Forcast │ wdir        │ number │
    │ 11537068 │ OpenWeatherMap Forcast │ wspeed      │ number │
    │ 11537068 │ OpenWeatherMap Forcast │ humidity    │ number │
    │ 11537068 │ OpenWeatherMap Forcast │ cloudiness  │ number │
    │ 11537068 │ OpenWeatherMap Forcast │ visibility  │ number │
    │ 11537068 │ OpenWeatherMap Forcast │ sky         │ string │
    │ 11537068 │ OpenWeatherMap Forcast │ iconId      │ string │
    └──────────┴────────────────────────┴─────────────┴────────┘


Exporting Datums
~~~~~~~~~~~~~~~~

Finally, let's export some of these datums following the usual process. The notable change here is that we're
providing the `-l, --loccation` flag:

.. code-block:: console

    $ sqc datums stream -s OpenWeatherMap -f timestamp,locationId,sourceId,atm,wdir,wdir\$maximum --start 2022-12-01 --end 2022-12-02 -a Day -o /tmp/out.txt -l 11537068
    $ head /tmp/out.txt
    1669870800000,11537068,OpenWeatherMap,102615.38461538461,289.7692307692308,330

Otherwise, the behaviour should emulate the usual datums process.

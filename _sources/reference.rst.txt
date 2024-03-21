Reference
===============

Exporting Datums
----------------

Meta Values
~~~~~~~~~~~

SolarQuant provides tools to reason about different interpretations for each value. These are context dependant, and
are enumerated below. If we take an example instruction below:

.. code-block:: console

    $ sqc datums stream /MA/**/INV/* timestamp,watts,watts\$count 2022-05-01 2022-06-01 -a Day > datums.csv

.. warning::

    When entering a meta value on a shell, you should escape the `$` character by adding a `\\` character at the
    beginning. This stops your shell from expanding a variable.

The columns `watts` and `watts$count` are requested. In this case, simply typing `watts` is a shorthand for requesting
`watts$average`, for more information read the below sections.

Aggregation
~~~~~~~~~~~

SolarNetwork supports aggregating multiple datums into a single datum [#]_. The behaviour of aggregation is sometimes
complex, so SolarQuant simplifies this process for the user.

The following aggregation values are supported for `-a` / `--aggregation`:

 * `FiveMinute`
 * `TenMinute`
 * `FifteenMinute`
 * `ThirtyMinute`
 * `Hour`
 * `HourOfDay`
 * `SeasonalHourOfDay`
 * `Day`
 * `DayOfWeek`
 * `SeasonalDayOfWeek`
 * `Week`
 * `Month`
 * `Year`
 * `RunningTotal`


Instantaneous
+++++++++++++

Instantaneous measurements correspond to absolute values measured at a given time. When aggregating multiple datums
into a single datum, SolarNetwork gives us the following values to use.

Meta values supported:

- `$average`: Returns the average of all measurements that are being aggregated against.

- `$count`: Returns the number of datums that have been aggregated.

- `$minimum`: Returns the minimum measurement value.

- `$maximum`: Returns the maximum measurement value.

.. note::

    The `$count` meta value is not supported when exporting location datums. This is because the count is not provided
    by SolarNetwork at this time.

Accumulating
++++++++++++

Accumulating measurements correspond to a value which is monotonically increasing, which is to say accumulates over
time without decreasing.

Meta values supported:

- `$starting`: Returns the starting value of the accumulating value in the requested time period.

- `$ending`: Returns the ending value of the accumulating value in the requested time period.

- `$difference`: Returns the difference between the two above values.

Status
++++++

Status values always return the most recent value.

 .. [#] https://github.com/SolarNetwork/solarnetwork/wiki/SolarNet-aggregation

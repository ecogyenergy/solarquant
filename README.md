## SolarQuant

This repository contains the SolarQuant environment tooling, which allows
the user to easily source training data to be used for training machine
learning predictors. SolarQuant works by consuming OrangeButton and
SolarNetwork (http://solarnetwork.net) data, both of which are free and open source.

A containerized ready to go version of SolarQuant is maintained here: https://hub.docker.com/r/ecogyenergy/solarquant

### Documentation

A live pre-built version of the SolarQuant documentation is available here: https://ecogyenergy.github.io/solarquant

To build the latest documentation from source, compile the Sphinx[1] documentation in the `docs` directory:

```shell
$ cd docs
$ make html
```

[1]: https://www.sphinx-doc.org/en/master/

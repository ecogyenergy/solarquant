import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from sklearn.metrics import mean_absolute_error
from lightgbm import LGBMRegressor

df = pd.read_csv('datums.csv')
df.drop('sourceId', axis=1, inplace=True)
df.drop('objectId', axis=1, inplace=True)

df['voltage$average'] = df['voltage$average'].astype(float)
df = df.set_index(df.timestamp)

X = df.drop('timestamp', axis=1)
y = df['voltage$average']

# Take a horizon of 7 days, assuming we have an entry for every
# hour this means 7 * 24 entries
horizon = 7 * 24

# Take most of the data for training, leave some of it for testing
X_train, X_test = X.iloc[:-horizon,:], X.iloc[-horizon:,:]
y_train, y_test = y.iloc[:-horizon], y.iloc[-horizon:]

model = LGBMRegressor()
model.fit(X_train, y_train)
predictions = model.predict(X_test)

mae = np.round(mean_absolute_error(y_test, predictions), 3)

fig = plt.figure(figsize=(16,6))
plt.title(f'Real vs Prediction - MAE {mae}', fontsize=20)
plt.plot(y_test, color='red')
plt.plot(pd.Series(predictions, index=y_test.index), color='green')
plt.xlabel('Timestamp', fontsize=16)
plt.ylabel('Average Voltage Reading', fontsize=16)
plt.legend(labels=['Real', 'Prediction'], fontsize=16)
plt.grid()

plt.savefig('fig.png')

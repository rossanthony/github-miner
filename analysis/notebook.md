# Using Jupyter notebook to inspect the data

- Describe the data

```python
import os
import pandas as pd

pd.options.display.float_format = "{:.2f}".format
data = pd.read_csv(os.getcwd() + "/analysis/gitrepo-properties.csv")
data.describe()
```

- Plot a histogram for each of the numerical data points

```python
%matplotlib inline
import matplotlib.pyplot as plt
import os
import pandas as pd

pd.options.display.float_format = "{:.2f}".format
data = pd.read_csv(os.getcwd() + "/analysis/gitrepo-properties.csv")
data.hist(bins=250, figsize=(20,15))
plt.show()
plt.savefig(os.getcwd() + "/analysis/gitrepos-histogram.svg")
```


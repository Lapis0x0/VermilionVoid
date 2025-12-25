---
title: 股票指数投资组合VaR（在险价值）的计算
published: 2024-06-15
description: "作为风险评估的核心工具，Value at Risk (VaR) 能有效量化投资组合在未来特定时间内可能遭受的最大损失概率，为投资者提供了决策的“安全边际”。本文假设有一个投资者使用10000美刀来投资道琼斯工业指数、上证、深证和日经225，来计算该投资组合的VaR。 一、完整代码 import yf"
image: ""
tags: []
category: 金融与经济
draft: false
---
作为风险评估的核心工具，Value at Risk (VaR) 能有效量化投资组合在未来特定时间内可能遭受的最大损失概率，为投资者提供了决策的“安全边际”。本文假设有一个投资者使用10000美刀来投资道琼斯工业指数、上证、深证和日经225，来计算该投资组合的VaR。

# 一、完整代码

```python
import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime

# 定义股票指数和时间段
indices = {
    'DJIA': '^DJI',
    'SSE Composite': '000001.SS',
    'Shenzhen Component': '399001.SZ',
    'Nikkei 225': '^N225'
}
start_date = '2020-01-01'
end_date = '2020-03-01'

# 获取数据
data = yf.download(list(indices.values()), start=start_date, end=end_date)['Adj Close']
data.columns = indices.keys()

# 手动设置2020年1月1日的汇率
exchange_rates = {
    'SSE Composite': 0.143,  # 2020年1月1日1 CNY = 0.143 USD
    'Shenzhen Component': 0.143,  # 2020年1月1日1 CNY = 0.143 USD
    'Nikkei 225': 0.0093  # 2020年1月1日1 JPY = 0.0093 USD
}

# 转换非美元指数为美元
for index in exchange_rates.keys():
    data[index] = data[index] * exchange_rates[index]

# 计算每日收益率
returns = data.pct_change().dropna()

# 计算投资组合每日收益率
weights = np.array([0.4, 0.3, 0.2, 0.1])  # 根据新指数调整权重
portfolio_returns = returns.dot(weights)

# 计算VaR
confidence_level = 0.95
var = np.percentile(portfolio_returns, (1 - confidence_level) * 100)

print(f"投资组合的VaR为: {var}")

# 可视化投资组合每日收益率分布
plt.hist(portfolio_returns, bins=50, alpha=0.75, edgecolor='black')
plt.title('Portfolio Daily Returns Distribution')
plt.xlabel('Daily Returns')
plt.ylabel('Frequency')
plt.axvline(var, color='r', linestyle='dashed', linewidth=2, label=f'VaR at {confidence_level*100}% confidence level: {var:.4f}')
plt.legend()
plt.show()
```

# 二、代码解析

## 1.导入所需库

```python
import yfinance as yf
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from datetime import datetime
```

•	yfinance: 用于从Yahoo Finance获取金融数据。 •	pandas: 数据处理和分析库。 •	numpy: 数值计算库。 •	matplotlib.pyplot: 绘图库。 •	datetime: 处理日期和时间。

需要你自行安装相应的python库（记得在终端安装，直接用Python不行的）

## 2.定义**股票指数和时间段**

```python
indices = {
    'DJIA': '^DJI',
    'SSE Composite': '000001.SS',
    'Shenzhen Component': '399001.SZ',
    'Nikkei 225': '^N225'
}
start_date = '2020-01-01'
end_date = '2020-03-01'
```

四个股票指数分别是道琼斯、上证、深证和日经，可以根据需要自己修改。

我选取的开始时间和结束时间分别为2020-01-01到2020-03-01，这个根据自己情况另行选择

## 3.获取数据

```python
data = yf.download(list(indices.values()), start=start_date, end=end_date)['Adj Close']
data.columns = indices.keys()
```

•	使用yfinance库下载指定时间段内的股票指数数据。 •	提取调整收盘价（Adj Close）数据，并将列名替换为指数名称。

## 4.手动设置汇率

```python
exchange_rates = {
    'SSE Composite': 0.143,  # 2020年1月1日1 CNY = 0.143 USD
    'Shenzhen Component': 0.143,  # 2020年1月1日1 CNY = 0.143 USD
    'Nikkei 225': 0.0093  # 2020年1月1日1 JPY = 0.0093 USD
}
```

```
•	定义每个非美元指数的初始汇率，具体需要自己查询（我没找到对应的自动化接口）
```

## 5.**转换非美元指数为美元**

```python
for index in exchange_rates.keys():
    data[index] = data[index] * exchange_rates[index]
```

将非美元指数转化为美元，方便统一计算

## 6.计算每日收益率

```python
returns = data.pct_change().dropna()
```

计算每日收益率，并删除缺失值。

## 7.计算投资组合每日收益率

```python
weights = np.array([0.4, 0.3, 0.2, 0.1])  # 根据新指数调整权重
portfolio_returns = returns.dot(weights)
```

* 定义投资组合的权重
* 计算投资组合每日收益率

在10000美刀的投资组合中，四个指数分别占比40%、30%、20%和10%，可以按照需要自己调整。

## 8.计算VaR

```python
confidence_level = 0.95
var = np.percentile(portfolio_returns, (1 - confidence_level) * 100)
print(f"投资组合的VaR为: {var}")
```

计算95%置信水平下的VaR值。

## 9.**可视化投资组合每日收益率分布**

```python
plt.hist(portfolio_returns, bins=50, alpha=0.75, edgecolor='black')
plt.title('Portfolio Daily Returns Distribution')
plt.xlabel('Daily Returns')
plt.ylabel('Frequency')
plt.axvline(var, color='r', linestyle='dashed', linewidth=2, label=f'VaR at {confidence_level*100}% confidence level: {var:.4f}')
plt.legend()
plt.show()
```

绘制投资组合每日收益率的分布直方图。 在图上标注VaR值，并显示图例。

如果一切正常的话，这段代码的运行结果应该是：

![image-cauo.png](https://blog-1302893975.cos.ap-beijing.myqcloud.com/pic/202406152124196.png)

即这份投资组合在限定时间内，VaR应该为-0.0240，在95%的置信水平下，该投资组合在一天内的最大可能损失为240美元（这意味着有95%的概率，该投资组合在一天内的损失不会超过240美元。相应地，也意味着有5%的概率损失会超过240美元）

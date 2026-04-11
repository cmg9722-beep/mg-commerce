"""1688 중국어 메시지 자동 생성 모듈"""
from config import WAREHOUSE

TEMPLATES = {
    "sample_order": {
        "label": "샘플 주문",
        "label_cn": "样品订购",
        "generate": lambda p: f"""你好，我想先订购样品。
产品：{p.get('product', '[제품명]')}
数量：{p.get('qty', '1')}个
收货地址：{WAREHOUSE['address_cn']}
收件人：{WAREHOUSE['receiver']}
电话：{WAREHOUSE['phone']}
邮编：{WAREHOUSE['zip']}
{p.get('extra', '')}""".strip()
    },
    "price_inquiry": {
        "label": "대량 단가 문의",
        "label_cn": "批量价格咨询",
        "generate": lambda p: f"""你好，请问以下数量的单价分别是多少？
产品：{p.get('product', '[제품명]')}
100个：？
300个：？
500个：？
1000个：？
另外，请问有MOQ要求吗？"""
    },
    "cert_request": {
        "label": "인증서류 요청",
        "label_cn": "认证文件请求",
        "generate": lambda _: """你好，还有一个问题。
请问贵公司能提供以下技术文件吗？
1. 产品检测报告（SGS或同等机构）
2. MSDS（材料安全数据表）
3. RoHS检测报告
4. 产品规格书（TDS）- 包含耐热温度、厚度、拉伸强度等参数

这些资料对韩国市场销售非常重要，客户可能会要求提供。谢谢！"""
    },
    "warehouse_info": {
        "label": "창고 주소 전달",
        "label_cn": "仓库地址",
        "generate": lambda _: f"""您好，请将商品发送到以下地址：
收货地址：{WAREHOUSE['address_cn']}
收件人：{WAREHOUSE['receiver']}
电话：{WAREHOUSE['phone']}
邮编：{WAREHOUSE['zip']}

这是转运仓库，直接快递发到这个地址就可以，不需要特别的入库手续，也不会产生额外保管费。"""
    },
    "thanks_free": {
        "label": "무료 샘플 감사",
        "label_cn": "免费样品感谢",
        "generate": lambda p: f"""谢谢老板！公司名：MG COMMERCE（앰지커머스）
{p.get('extra', '')}""".strip()
    },
    "bulk_order": {
        "label": "본발주 (대량 주문)",
        "label_cn": "批量订单",
        "generate": lambda p: f"""你好，我们对样品非常满意，想正式下单。
产品：{p.get('product', '[제품명]')}
数量：{p.get('qty', '100')}个
单价：{p.get('unit_price', '请确认')}
收货地址：{WAREHOUSE['address_cn']}
收件人：{WAREHOUSE['receiver']}
电话：{WAREHOUSE['phone']}
邮编：{WAREHOUSE['zip']}

请确认交期和总金额。谢谢！"""
    },
    "quality_issue": {
        "label": "품질 문제 문의",
        "label_cn": "质量问题",
        "generate": lambda p: f"""你好，我们收到了货物，但发现以下问题：
产品：{p.get('product', '[제품명]')}
问题描述：{p.get('issue', '[문제 설명]')}

请问如何处理？是否可以换货或退款？谢谢！"""
    },
}


def generate_message(template_key, params=None):
    """메시지 템플릿으로 중국어 메시지 생성"""
    if params is None:
        params = {}
    tpl = TEMPLATES.get(template_key)
    if not tpl:
        return None
    return {
        "key": template_key,
        "label": tpl["label"],
        "label_cn": tpl["label_cn"],
        "message": tpl["generate"](params),
    }


def get_all_templates():
    """모든 템플릿 목록"""
    return [
        {"key": k, "label": v["label"], "label_cn": v["label_cn"]}
        for k, v in TEMPLATES.items()
    ]

#!/usr/bin/env python3
import base64
import io
import json
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
R_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
P_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
ET.register_namespace('w', W_NS)
ET.register_namespace('', P_NS)


def qn(ns, tag):
    return f"{{{ns}}}{tag}"


RULES = [
    (["自动续期", "续期"], "建议明确续期条件与提前通知期限，避免默认自动续期导致不必要义务。"),
    (["违约金", "罚金"], "建议补充违约金上限或计算标准，并明确是否可与损失赔偿并行主张。"),
    (["单方解除", "任意解除"], "建议增加单方解除的触发条件、补救期和通知方式，降低争议风险。"),
    (["保密"], "建议补充保密期限、例外情形及违约责任。"),
    (["不可抗力"], "建议约定不可抗力通知时限、举证责任及减损义务。"),
    (["争议", "仲裁", "管辖"], "建议明确争议解决机构与适用法律，避免管辖条款冲突。"),
    (["付款", "支付"], "建议明确付款节点、开票要求、逾期利息和暂停履行条件。"),
]


def paragraph_text(p):
    texts = []
    for t in p.findall('.//' + qn(W_NS, 't')):
        texts.append(t.text or '')
    return ''.join(texts).strip()


def pick_comments(paragraphs):
    issues = []
    for idx, text in paragraphs:
        if not text:
            continue
        for keywords, advice in RULES:
            if any(k in text for k in keywords):
                issues.append((idx, text, advice))
                break
    if not issues:
        for idx, text in paragraphs:
            if text:
                issues.append((idx, text, "建议补充定义条款、权利义务边界、违约责任和争议解决机制。"))
                break
    return issues


def ensure_comments_relationship(rels_xml):
    tree = ET.fromstring(rels_xml)
    rels = tree.findall(qn(R_NS, 'Relationship'))
    for rel in rels:
        if rel.get('Type') == REL_NS + '/comments':
            return rel.get('Id'), ET.tostring(tree, encoding='utf-8', xml_declaration=True)

    existing_ids = [r.get('Id', '') for r in rels]
    n = 1
    while f'rId{n}' in existing_ids:
        n += 1
    rel_id = f'rId{n}'
    ET.SubElement(tree, qn(R_NS, 'Relationship'), {
        'Id': rel_id,
        'Type': REL_NS + '/comments',
        'Target': 'comments.xml'
    })
    return rel_id, ET.tostring(tree, encoding='utf-8', xml_declaration=True)


def ensure_content_type(ct_xml):
    tree = ET.fromstring(ct_xml)
    overrides = tree.findall(qn(P_NS, 'Override'))
    target = '/word/comments.xml'
    for ov in overrides:
        if ov.get('PartName') == target:
            return ET.tostring(tree, encoding='utf-8', xml_declaration=True)

    ET.SubElement(tree, qn(P_NS, 'Override'), {
        'PartName': target,
        'ContentType': 'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml'
    })
    return ET.tostring(tree, encoding='utf-8', xml_declaration=True)


def make_comment_xml(issues):
    comments = ET.Element(qn(W_NS, 'comments'))
    for i, (_, _, advice) in enumerate(issues):
        c = ET.SubElement(comments, qn(W_NS, 'comment'), {
            qn(W_NS, 'id'): str(i),
            qn(W_NS, 'author'): '合同审查助手',
            qn(W_NS, 'initials'): 'AI',
            qn(W_NS, 'date'): datetime.utcnow().replace(microsecond=0).isoformat() + 'Z'
        })
        p = ET.SubElement(c, qn(W_NS, 'p'))
        r = ET.SubElement(p, qn(W_NS, 'r'))
        t = ET.SubElement(r, qn(W_NS, 't'))
        t.text = advice
    return ET.tostring(comments, encoding='utf-8', xml_declaration=True)


def attach_markers(document_root, issues):
    body = document_root.find(qn(W_NS, 'body'))
    if body is None:
        return
    paragraphs = body.findall('.//' + qn(W_NS, 'p'))
    for cid, (pidx, _, _) in enumerate(issues):
        if pidx >= len(paragraphs):
            continue
        p = paragraphs[pidx]
        children = list(p)
        if not children:
            continue
        first_run_index = None
        for i, ch in enumerate(children):
            if ch.tag == qn(W_NS, 'r'):
                first_run_index = i
                break
        if first_run_index is None:
            continue

        start = ET.Element(qn(W_NS, 'commentRangeStart'), {qn(W_NS, 'id'): str(cid)})
        end = ET.Element(qn(W_NS, 'commentRangeEnd'), {qn(W_NS, 'id'): str(cid)})
        ref_run = ET.Element(qn(W_NS, 'r'))
        ET.SubElement(ref_run, qn(W_NS, 'commentReference'), {qn(W_NS, 'id'): str(cid)})

        p.insert(first_run_index, start)
        p.insert(first_run_index + 2, end)
        p.insert(first_run_index + 3, ref_run)


def process(src_bytes):
    zin = zipfile.ZipFile(io.BytesIO(src_bytes), 'r')
    files = {name: zin.read(name) for name in zin.namelist()}

    if 'word/document.xml' not in files:
        raise ValueError('不是有效的 Word 文档（缺少 word/document.xml）')

    doc_root = ET.fromstring(files['word/document.xml'])
    paras = []
    all_paras = doc_root.findall('.//' + qn(W_NS, 'p'))
    for i, p in enumerate(all_paras):
        paras.append((i, paragraph_text(p)))

    issues = pick_comments(paras)
    attach_markers(doc_root, issues)
    files['word/document.xml'] = ET.tostring(doc_root, encoding='utf-8', xml_declaration=True)
    files['word/comments.xml'] = make_comment_xml(issues)

    rels_path = 'word/_rels/document.xml.rels'
    if rels_path in files:
        _, rels_xml = ensure_comments_relationship(files[rels_path])
        files[rels_path] = rels_xml
    else:
        rels = ET.Element(qn(R_NS, 'Relationships'))
        ET.SubElement(rels, qn(R_NS, 'Relationship'), {
            'Id': 'rId1',
            'Type': REL_NS + '/comments',
            'Target': 'comments.xml'
        })
        files[rels_path] = ET.tostring(rels, encoding='utf-8', xml_declaration=True)

    ct_path = '[Content_Types].xml'
    if ct_path in files:
        files[ct_path] = ensure_content_type(files[ct_path])

    out = io.BytesIO()
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zout:
        for name, content in files.items():
            zout.writestr(name, content)

    return out.getvalue(), issues


def main():
    payload = json.load(sys.stdin)
    src = base64.b64decode(payload['contentBase64'])
    reviewed, issues = process(src)
    result = {
        'reviewedBase64': base64.b64encode(reviewed).decode('ascii'),
        'issues': [
            {'paragraphIndex': idx, 'text': text[:120], 'comment': advice}
            for idx, text, advice in issues
        ]
    }
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == '__main__':
    main()

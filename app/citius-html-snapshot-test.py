import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('snapshot',Path(__file__).with_name('citius-html-snapshot.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class SnapshotTest(unittest.TestCase):
    def test_repeated_rows_and_unmodeled_attributes(self):
        row='<tr data-procinfo="uuid" data-extra="null"><td>IMG</td><td>0</td><td><a class="downloadDocument" title="A &amp; B">Name</a></td></tr>'
        parsed=module.Parser('<table>'+row+row+'</table>')
        self.assertEqual(len(parsed.rows),2)
        self.assertEqual(parsed.rows[0]['attributes']['data-extra'],'null')
        self.assertEqual(parsed.rows[0]['cells'],['IMG','0','Name'])
        self.assertEqual(parsed.rows[0]['links'][0]['title'],'A & B')
    def test_nested_text_and_whitespace(self):
        parsed=module.Parser('<tr><td>Not MP  <small>das alegações</small></td></tr>')
        self.assertEqual(parsed.rows[0]['cells'],['Not MP  das alegações'])

if __name__=='__main__':unittest.main()
